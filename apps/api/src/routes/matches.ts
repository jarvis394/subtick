import { and, desc, eq, lt, schema, sql } from '@subtick/db'
import { isShareCode } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { importShareCode } from '../services/matches'
import { withClipUrls } from '../services/highlights'
import { authGuard } from './guard'

const PAGE_SIZE = 20
const { match, userMatch, matchPlayer, round, kill, highlight, clip, steamLink } = schema

export const matchRoutes = (ctx: Context) => {
  const { db, auth } = ctx

  return new Elysia({ prefix: '/matches' })
    .use(authGuard(auth))
    .get(
      '/',
      async ({ user, query }) => {
        const rows = await db
          .select({
            id: match.id,
            status: match.status,
            map: match.map,
            playedAt: match.playedAt,
            roundsPlayed: match.roundsPlayed,
            scoreStartedCt: match.scoreStartedCt,
            scoreStartedT: match.scoreStartedT,
            discoveredAt: userMatch.discoveredAt,
            steamId: userMatch.steamId,
            player: { startingSide: matchPlayer.startingSide, stats: matchPlayer.stats },
            highlightCount: sql<number>`(
              select count(*)::int from ${highlight}
              where ${highlight.matchId} = ${match.id} and ${highlight.steamId} = ${userMatch.steamId}
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
              query.cursor ? lt(userMatch.discoveredAt, new Date(query.cursor)) : undefined,
            ),
          )
          .orderBy(desc(userMatch.discoveredAt))
          .limit(PAGE_SIZE)

        return {
          items: rows,
          nextCursor: rows.length === PAGE_SIZE ? rows.at(-1)!.discoveredAt.toISOString() : null,
        }
      },
      { auth: true, query: z.object({ cursor: z.iso.datetime().optional() }) },
    )
    .get(
      '/:id',
      async ({ params, status }) => {
        const [row] = await db.select().from(match).where(eq(match.id, params.id))
        if (!row) return status(404, { error: 'not_found' as const })

        const [players, rounds, kills, highlights] = await Promise.all([
          db.select().from(matchPlayer).where(eq(matchPlayer.matchId, row.id)),
          db.select().from(round).where(eq(round.matchId, row.id)).orderBy(round.number),
          db.select().from(kill).where(eq(kill.matchId, row.id)).orderBy(kill.tick),
          db
            .select({ highlight, clip })
            .from(highlight)
            .leftJoin(clip, eq(clip.highlightId, highlight.id))
            .where(eq(highlight.matchId, row.id))
            .orderBy(desc(highlight.score)),
        ])

        const { shareCode: _, demoKey: __, error: ___, ...publicMatch } = row
        return {
          match: publicMatch,
          players,
          rounds,
          kills,
          highlights: withClipUrls(ctx, highlights),
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
}
