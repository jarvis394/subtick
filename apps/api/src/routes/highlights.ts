import { and, desc, eq, or, schema } from '@subtick/db'
import { requeue } from '@subtick/queue'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { clipFacets, clipFilterQuery, clipFilterWhere } from '../services/clip-filters'
import { notOneKill, playedAt, withClipUrls } from '../services/highlights'
import { actorOf, cancelHighlight } from '../services/matches'
import { getProfiles } from '../services/profiles'
import { authGuard } from './guard'

const PAGE_SIZE = 24
const { highlight, clip, match, matchPlayer } = schema

/** Every user's recorded clips are shared with everyone signed in. */
export const highlightRoutes = (ctx: Context) => {
  const { db, auth, queues } = ctx

  /** Recorded clips with what a card shows: the match's map and date, and who made the play. */
  const selectClips = () =>
    db
      .select({ highlight, clip, map: match.map, playedAt, playerName: matchPlayer.name })
      .from(highlight)
      .innerJoin(match, eq(match.id, highlight.matchId))
      .innerJoin(clip, eq(clip.highlightId, highlight.id))
      .innerJoin(
        matchPlayer,
        and(eq(matchPlayer.matchId, highlight.matchId), eq(matchPlayer.steamId, highlight.steamId)),
      )
      .$dynamic()

  const present = async (rows: Awaited<ReturnType<typeof selectClips>>) => {
    const withUrls = withClipUrls(ctx, rows)
    const profiles = await getProfiles(
      ctx,
      rows.map((row) => row.highlight.steamId),
    )

    return rows.map((row, i) => ({
      ...withUrls[i]!,
      map: row.map,
      playedAt: row.playedAt,
      player: {
        name: row.playerName,
        avatarUrl: profiles.get(row.highlight.steamId)?.avatarUrl ?? null,
        vanity: profiles.get(row.highlight.steamId)?.vanity ?? null,
      },
    }))
  }

  return new Elysia({ prefix: '/highlights' })
    .use(authGuard(auth))
    .get(
      '/',
      async ({ user, query }) => {
        const rows = await selectClips()
          .where(
            and(eq(highlight.status, 'recorded'), notOneKill, clipFilterWhere(db, user.id, query)),
          )
          // Newest match first; within a match, best moment first.
          .orderBy(desc(playedAt), desc(highlight.score))
          .limit(PAGE_SIZE + 1)
          .offset(query.offset)

        return {
          items: await present(rows.slice(0, PAGE_SIZE)),
          nextOffset: rows.length > PAGE_SIZE ? query.offset + PAGE_SIZE : null,
        }
      },
      {
        auth: true,
        query: clipFilterQuery.extend({
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    )
    .get('/facets', ({ query }) => clipFacets(ctx, query.steamId), {
      auth: true,
      query: z.object({ steamId: z.string().optional() }),
    })
    .get(
      '/:id',
      async ({ params, status }) => {
        const rows = await selectClips().where(
          and(eq(highlight.id, params.id), eq(highlight.status, 'recorded')),
        )
        if (!rows.length) return status(404, { error: 'not_found' as const })
        const [item] = await present(rows)

        return item!
      },
      { auth: true, params: z.object({ id: z.uuid() }) },
    )
    .post(
      '/:id/record',
      async ({ user, params, status }) => {
        // Only candidates (never queued) and failures can be (re)queued; anything else is a no-op.
        const [row] = await db
          .update(highlight)
          .set({ status: 'queued', requestedBy: user.id, error: null })
          .where(
            and(
              eq(highlight.id, params.id),
              or(eq(highlight.status, 'candidate'), eq(highlight.status, 'failed')),
            ),
          )
          .returning({ id: highlight.id, matchId: highlight.matchId })

        if (row) {
          // Lazy requests rank below freshly discovered matches. A retried failure (or a clip
          // cancelled and requested again) left a finished job under the same id; requeue clears it.
          await requeue(
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
    .post(
      '/:id/cancel',
      async ({ user, params, status }) => {
        // Only the person who asked for it, the match's players for clips subtick queued itself,
        // and admins.
        const result = await cancelHighlight(ctx, params.id, actorOf(user))
        if (!result) return status(404, { error: 'not_found' as const })
        if (result === 'forbidden') return status(403, { error: 'forbidden' as const })

        return { status: result }
      },
      { auth: true, params: z.object({ id: z.uuid() }) },
    )
}
