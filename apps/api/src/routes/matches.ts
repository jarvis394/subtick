import { and, desc, eq, inArray, lt, schema, sql } from '@subtick/db'
import { isCancelled, isShareCode } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { actorOf, cancelMatch, importShareCode, retryMatch } from '../services/matches'
import { syncNow } from '../services/sync-now'
import { withParties } from '../services/parties'
import { getProfiles } from '../services/profiles'
import { notOneKill, withClipUrls } from '../services/highlights'
import { authGuard } from './guard'

const PAGE_SIZE = 20

const {
  match,
  userMatch,
  matchPlayer,
  round,
  kill,
  highlight,
  clip,
  steamLink,
  user: account,
} = schema

export const matchRoutes = (ctx: Context) => {
  const { db, auth } = ctx

  /** Newest played first; a match not resolved yet sorts by when it was found. */
  const playedOrDiscovered = sql`coalesce(${match.playedAt}, ${userMatch.discoveredAt})`

  /** Spending or stopping pipeline work is for people who have the match, and admins. */
  const canManage = async (user: { id: string; role?: string | null }, matchId: string) => {
    if (user.role === 'admin') return true
    const [own] = await db
      .select({ matchId: userMatch.matchId })
      .from(userMatch)
      .where(and(eq(userMatch.matchId, matchId), eq(userMatch.userId, user.id)))

    return Boolean(own)
  }

  return new Elysia({ prefix: '/matches' })
    .use(authGuard(auth))
    .get(
      '/',
      async ({ user, query }) => {
        const rows = await db
          .select({
            id: match.id,
            status: match.status,
            error: match.error,
            map: match.map,
            playedAt: match.playedAt,
            roundsPlayed: match.roundsPlayed,
            scoreStartedCt: match.scoreStartedCt,
            scoreStartedT: match.scoreStartedT,
            discoveredAt: userMatch.discoveredAt,
            steamId: userMatch.steamId,
            mode: match.mode,
            shareCode: match.shareCode,
            /** Valve's copy, until it expires; subtick keeps its own for parsing. */
            demoUrl: match.demoUrl,
            demoExpiresAt: match.demoExpiresAt,
            player: {
              startingSide: matchPlayer.startingSide,
              stats: matchPlayer.stats,
              rank: matchPlayer.rank,
            },
            highlightCount: sql<number>`(
              select count(*)::int from ${highlight}
              where ${highlight.matchId} = ${match.id} and ${highlight.steamId} = ${userMatch.steamId}
                and ${notOneKill}
            )`,
          })
          .from(userMatch)
          .innerJoin(match, eq(match.id, userMatch.matchId))
          .leftJoin(
            matchPlayer,
            and(eq(matchPlayer.matchId, match.id), eq(matchPlayer.steamId, userMatch.steamId)),
          )
          .where(
            and(
              eq(userMatch.userId, user.id),
              query.cursor ? lt(playedOrDiscovered, new Date(query.cursor)) : undefined,
            ),
          )
          .orderBy(desc(playedOrDiscovered))
          .limit(query.limit)

        return {
          items: rows.map(({ error, ...row }) => ({
            ...row,
            cancelled: isCancelled({ status: row.status, error }),
          })),
          nextCursor:
            rows.length === query.limit
              ? (rows.at(-1)!.playedAt ?? rows.at(-1)!.discoveredAt).toISOString()
              : null,
        }
      },
      {
        auth: true,
        query: z.object({
          cursor: z.iso.datetime().optional(),
          limit: z.coerce.number().int().min(1).max(PAGE_SIZE).default(PAGE_SIZE),
        }),
      },
    )
    .get(
      '/:id',
      async ({ user, params, status }) => {
        const [row] = await db.select().from(match).where(eq(match.id, params.id))
        if (!row) return status(404, { error: 'not_found' as const })

        const [players, rounds, kills, highlights, [viewer]] = await Promise.all([
          db.select().from(matchPlayer).where(eq(matchPlayer.matchId, row.id)),
          db.select().from(round).where(eq(round.matchId, row.id)).orderBy(round.number),
          db.select().from(kill).where(eq(kill.matchId, row.id)).orderBy(kill.tick),
          db
            .select({ highlight, clip })
            .from(highlight)
            .leftJoin(clip, eq(clip.highlightId, highlight.id))
            .where(and(eq(highlight.matchId, row.id), notOneKill))
            .orderBy(desc(highlight.score)),
          db
            .select({ steamId: userMatch.steamId })
            .from(userMatch)
            .where(and(eq(userMatch.matchId, row.id), eq(userMatch.userId, user.id))),
        ])

        const requesterIds = [
          ...new Set(
            highlights.flatMap((h) => (h.highlight.requestedBy ? [h.highlight.requestedBy] : [])),
          ),
        ]
        const [profiles, partied, requesters] = await Promise.all([
          getProfiles(
            ctx,
            players.map((p) => p.steamId),
          ),
          withParties(ctx, row.id, players),
          requesterIds.length
            ? db
                .select({ id: account.id, name: account.name, image: account.image })
                .from(account)
                .where(inArray(account.id, requesterIds))
            : [],
        ])
        const requesterById = new Map(requesters.map((r) => [r.id, r]))
        const admin = user.role === 'admin'
        const owns = Boolean(viewer)
        const { shareCode: _, demoKey: __, error: ___, parties: ____, ...publicMatch } = row

        return {
          match: { ...publicMatch, cancelled: isCancelled(row) },
          /** The viewer's player in this match, if they played it. */
          viewerSteamId: viewer?.steamId ?? null,
          players: partied.map((p) => ({
            ...p,
            avatarUrl: profiles.get(p.steamId)?.avatarUrl ?? null,
          })),
          rounds,
          kills,
          highlights: withClipUrls(ctx, highlights).map((h, i) => {
            const { requestedBy } = highlights[i]!.highlight
            const requester = requestedBy ? requesterById.get(requestedBy) : undefined

            return {
              ...h,
              /** Who asked for it to be recorded; null when subtick queued it itself. */
              requester: requester
                ? {
                    name: requester.name,
                    image: requester.image ?? null,
                    isViewer: requester.id === user.id,
                  }
                : null,
              /** The viewer may take it off the queue (mirrors the cancel endpoint's rule). */
              canCancel: admin || requestedBy === user.id || (requestedBy === null && owns),
            }
          }),
        }
      },
      { auth: true, params: z.object({ id: z.string().regex(/^\d+$/) }) },
    )
    .post(
      '/import',
      async ({ user, body, status }) => {
        const links = await db
          .select({ steamId: steamLink.steamId })
          .from(steamLink)
          .where(eq(steamLink.userId, user.id))
        const steamId = body.steamId ?? links[0]?.steamId
        if (!steamId || !links.some((l) => l.steamId === steamId)) {
          return status(409, { error: 'steam_not_linked' as const })
        }

        return importShareCode(ctx, { userId: user.id, steamId, shareCode: body.shareCode })
      },
      {
        auth: true,
        body: z.object({
          shareCode: z
            .string()
            .trim()
            .refine(isShareCode, 'Expected CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx'),
          steamId: z.string().optional(),
        }),
      },
    )
    .post(
      '/:id/retry',
      async ({ user, params, status }) => {
        if (!(await canManage(user, params.id))) return status(403, { error: 'forbidden' as const })
        const result = await retryMatch(ctx, params.id)
        if (!result) return status(404, { error: 'not_found' as const })

        return { status: result }
      },
      { auth: true, params: z.object({ id: z.string().regex(/^\d+$/) }) },
    )
    .post(
      '/:id/cancel',
      async ({ user, params, status }) => {
        // Who may stop what (stages, other people's requests) is decided per item inside.
        const result = await cancelMatch(ctx, params.id, actorOf(user))
        if (!result) return status(404, { error: 'not_found' as const })
        if (result === 'forbidden') return status(403, { error: 'forbidden' as const })

        return { status: result }
      },
      { auth: true, params: z.object({ id: z.string().regex(/^\d+$/) }) },
    )
    .post(
      '/refresh',
      async ({ user }) => {
        const links = await db
          .select({ steamId: steamLink.steamId })
          .from(steamLink)
          .where(eq(steamLink.userId, user.id))

        return syncNow(
          ctx,
          user.id,
          links.map((l) => l.steamId),
        )
      },
      { auth: true },
    )
}
