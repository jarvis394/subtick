import { and, desc, eq, inArray, or, schema, sql } from '@subtick/db'
import { HIGHLIGHT_KINDS, type HighlightKind } from '@subtick/domain'
import { enqueue } from '@subtick/queue'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { withClipUrls } from '../services/highlights'
import { getProfiles } from '../services/profiles'
import { authGuard } from './guard'

const PAGE_SIZE = 24
const { highlight, clip, match, matchPlayer, userMatch } = schema

/** A match's play time, falling back to when subtick first saw it. */
const playedAt = sql<Date>`coalesce(${match.playedAt}, ${match.createdAt})`.mapWith(match.createdAt)

const isHighlightKind = (value: string): value is HighlightKind =>
  HIGHLIGHT_KINDS.includes(value as HighlightKind)

/** Joins `user_match` so only the user's own player's highlights remain. */
const ownHighlight = (userId: string) =>
  and(
    eq(userMatch.userId, userId),
    eq(userMatch.matchId, highlight.matchId),
    eq(userMatch.steamId, highlight.steamId),
  )

export const highlightRoutes = (ctx: Context) => {
  const { db, auth, queues } = ctx

  return new Elysia({ prefix: '/highlights' })
    .use(authGuard(auth))
    .get(
      '/',
      async ({ user, query }) => {
        const kinds = query.kinds?.split(',').filter(isHighlightKind) ?? []
        const rows = await db
          .select({ highlight, clip, map: match.map, playedAt, playerName: matchPlayer.name })
          .from(highlight)
          .innerJoin(userMatch, ownHighlight(user.id))
          .innerJoin(match, eq(match.id, highlight.matchId))
          .innerJoin(clip, eq(clip.highlightId, highlight.id))
          .innerJoin(
            matchPlayer,
            and(
              eq(matchPlayer.matchId, highlight.matchId),
              eq(matchPlayer.steamId, highlight.steamId),
            ),
          )
          .where(
            and(
              eq(highlight.status, 'recorded'),
              kinds.length ? inArray(highlight.kind, kinds) : undefined,
              query.map ? eq(match.map, query.map) : undefined,
            ),
          )
          // Newest match first; within a match, best moment first.
          .orderBy(desc(playedAt), desc(highlight.score))
          .limit(PAGE_SIZE + 1)
          .offset(query.offset)

        const page = rows.slice(0, PAGE_SIZE)
        const withUrls = withClipUrls(ctx, page)
        const profiles = await getProfiles(
          ctx,
          page.map((row) => row.highlight.steamId),
        )
        return {
          items: page.map((row, i) => ({
            ...withUrls[i]!,
            map: row.map,
            playedAt: row.playedAt,
            player: {
              name: row.playerName,
              avatarUrl: profiles.get(row.highlight.steamId)?.avatarUrl ?? null,
            },
          })),
          nextOffset: rows.length > PAGE_SIZE ? query.offset + PAGE_SIZE : null,
        }
      },
      {
        auth: true,
        query: z.object({
          offset: z.coerce.number().int().min(0).default(0),
          /** Comma-separated highlight kinds. */
          kinds: z.string().optional(),
          map: z.string().optional(),
        }),
      },
    )
    .get(
      '/facets',
      async ({ user }) => {
        // Maps the user has clips on, for the filter bar.
        const maps = await db
          .selectDistinct({ map: match.map })
          .from(highlight)
          .innerJoin(userMatch, ownHighlight(user.id))
          .innerJoin(match, eq(match.id, highlight.matchId))
          .where(eq(highlight.status, 'recorded'))
        return { maps: maps.flatMap((m) => (m.map ? [m.map] : [])).toSorted() }
      },
      { auth: true },
    )
    .post(
      '/:id/record',
      async ({ params, status }) => {
        // Only candidates (never queued) and failures can be (re)queued; anything else is a no-op.
        const [row] = await db
          .update(highlight)
          .set({ status: 'queued' })
          .where(
            and(
              eq(highlight.id, params.id),
              or(eq(highlight.status, 'candidate'), eq(highlight.status, 'failed')),
            ),
          )
          .returning({ id: highlight.id, matchId: highlight.matchId })

        if (row) {
          // Lazy requests rank below freshly discovered matches.
          await enqueue(
            queues.recordClip,
            { matchId: row.matchId, highlightIds: [row.id] },
            { priority: 10 },
          )
          return { status: 'queued' as const }
        }

        const [existing] = await db
          .select({ status: highlight.status })
          .from(highlight)
          .where(eq(highlight.id, params.id))
        if (!existing) return status(404, { error: 'not_found' as const })
        return { status: existing.status }
      },
      { auth: true, params: z.object({ id: z.uuid() }) },
    )
}
