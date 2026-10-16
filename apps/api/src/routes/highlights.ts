import { and, desc, eq, inArray, lt, or, schema } from '@subtick/db'
import { enqueue } from '@subtick/queue'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { withClipUrls } from '../services/highlights'
import { authGuard } from './guard'

const PAGE_SIZE = 24
const { highlight, clip, match, steamLink } = schema

export const highlightRoutes = (ctx: Context) => {
  const { db, auth, queues } = ctx

  return new Elysia({ prefix: '/highlights' })
    .use(authGuard(auth))
    .get(
      '/',
      async ({ user, query }) => {
        const ownSteamIds = db
          .select({ steamId: steamLink.steamId })
          .from(steamLink)
          .where(eq(steamLink.userId, user.id))

        const rows = await db
          .select({ highlight, clip, map: match.map, playedAt: match.playedAt })
          .from(highlight)
          .innerJoin(match, eq(match.id, highlight.matchId))
          .leftJoin(clip, eq(clip.highlightId, highlight.id))
          .where(
            and(
              inArray(highlight.steamId, ownSteamIds),
              query.recordedOnly ? eq(highlight.status, 'recorded') : undefined,
              query.cursor ? lt(highlight.createdAt, new Date(query.cursor)) : undefined,
            ),
          )
          .orderBy(desc(highlight.createdAt), desc(highlight.score))
          .limit(PAGE_SIZE)

        const withUrls = withClipUrls(ctx, rows)
        return {
          items: rows.map((row, i) => ({ ...withUrls[i]!, map: row.map, playedAt: row.playedAt })),
          nextCursor:
            rows.length === PAGE_SIZE ? rows.at(-1)!.highlight.createdAt.toISOString() : null,
        }
      },
      {
        auth: true,
        query: z.object({
          cursor: z.iso.datetime().optional(),
          recordedOnly: z.stringbool().default(false),
        }),
      },
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
