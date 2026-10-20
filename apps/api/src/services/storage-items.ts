import { and, desc, eq, inArray, or, schema, sql } from '@subtick/db'
import { isProcessingStatus } from '@subtick/domain'
import type { Context } from '../context'
import type { ObjectSizes } from './storage'

const { match, matchPlayer, highlight, clip } = schema

const sizeOf = (sizes: Map<string, number>, key: string | null) => (key ? (sizes.get(key) ?? 0) : 0)

/** Every recorded clip, newest first, with what its video and poster take. */
export const listRecordedHighlights = async ({ db }: Pick<Context, 'db'>, sizes: ObjectSizes) => {
  const rows = await db
    .select({
      id: highlight.id,
      matchId: highlight.matchId,
      kind: highlight.kind,
      title: highlight.title,
      round: highlight.round,
      player: matchPlayer.name,
      map: match.map,
      videoKey: clip.videoKey,
      thumbnailKey: clip.thumbnailKey,
      recordedAt: clip.createdAt,
    })
    .from(clip)
    .innerJoin(highlight, eq(highlight.id, clip.highlightId))
    .innerJoin(match, eq(match.id, highlight.matchId))
    .leftJoin(
      matchPlayer,
      and(eq(matchPlayer.matchId, highlight.matchId), eq(matchPlayer.steamId, highlight.steamId)),
    )
    .orderBy(desc(clip.createdAt))
  return rows.map(({ videoKey, thumbnailKey, ...row }) => ({
    ...row,
    bytes: sizeOf(sizes.clips, videoKey) + sizeOf(sizes.clips, thumbnailKey),
  }))
}

/** Every match, most recently played first, with its demo and its clips' sizes. */
export const listStoredMatches = async ({ db }: Pick<Context, 'db'>, sizes: ObjectSizes) => {
  const [matches, clips] = await Promise.all([
    db
      .select({
        id: match.id,
        map: match.map,
        status: match.status,
        mode: match.mode,
        scoreStartedCt: match.scoreStartedCt,
        scoreStartedT: match.scoreStartedT,
        demoKey: match.demoKey,
        playedAt: match.playedAt,
        createdAt: match.createdAt,
      })
      .from(match)
      .orderBy(sql`${match.playedAt} desc nulls last`, desc(match.createdAt)),
    db
      .select({
        matchId: highlight.matchId,
        videoKey: clip.videoKey,
        thumbnailKey: clip.thumbnailKey,
      })
      .from(clip)
      .innerJoin(highlight, eq(highlight.id, clip.highlightId)),
  ])
  const byMatch = new Map<string, { count: number; bytes: number }>()
  for (const c of clips) {
    const entry = byMatch.get(c.matchId) ?? { count: 0, bytes: 0 }
    entry.count += 1
    entry.bytes += sizeOf(sizes.clips, c.videoKey) + sizeOf(sizes.clips, c.thumbnailKey)
    byMatch.set(c.matchId, entry)
  }
  return matches.map(({ demoKey, ...row }) => {
    const recorded = byMatch.get(row.id) ?? { count: 0, bytes: 0 }
    const demoBytes = sizeOf(sizes.demos, demoKey)
    return {
      ...row,
      clips: recorded.count,
      demoBytes,
      clipBytes: recorded.bytes,
      bytes: demoBytes + recorded.bytes,
    }
  })
}

/**
 * Removes objects once no clip row points at them any more. Dev tools' fake highlights borrow a
 * real clip's video, so a key can be shared. A failed delete leaves an orphan, not a broken row.
 */
const deleteUnreferenced = async (
  { db, clips, log }: Pick<Context, 'db' | 'clips' | 'log'>,
  objectKeys: string[],
) => {
  if (objectKeys.length === 0) return
  const still = await db
    .select({ videoKey: clip.videoKey, thumbnailKey: clip.thumbnailKey })
    .from(clip)
    .where(or(inArray(clip.videoKey, objectKeys), inArray(clip.thumbnailKey, objectKeys)))
  const kept = new Set(still.flatMap((c) => [c.videoKey, c.thumbnailKey]))
  const results = await Promise.allSettled(
    objectKeys.filter((key) => !kept.has(key)).map((key) => clips.delete(key)),
  )
  for (const r of results)
    if (r.status === 'rejected') log.warn({ error: String(r.reason) }, 'clip object delete failed')
}

/**
 * Deletes a highlight's recording: its clip row and files. The moment itself stays, back to a
 * candidate, so it can be recorded again.
 */
export const deleteRecordedHighlight = async (ctx: Context, id: string) => {
  const { db } = ctx
  const [row] = await db
    .select({ status: highlight.status, videoKey: clip.videoKey, thumbnailKey: clip.thumbnailKey })
    .from(clip)
    .innerJoin(highlight, eq(highlight.id, clip.highlightId))
    .where(eq(clip.highlightId, id))
  if (!row) return 'not_found' as const
  // The recorder would write a new clip row over the gap mid-delete.
  if (row.status === 'queued') return 'recording' as const

  await db.transaction(async (tx) => {
    await tx.delete(clip).where(eq(clip.highlightId, id))
    await tx
      .update(highlight)
      .set({ status: 'candidate', error: null, requestedBy: null })
      .where(eq(highlight.id, id))
  })
  await deleteUnreferenced(ctx, [row.videoKey, row.thumbnailKey])
  return 'deleted' as const
}

/**
 * Deletes a match for everyone: its rows (players, rounds, kills, highlights and clips cascade),
 * its demo and its clips' files. Steam sync only walks forward from each link's last share code,
 * so it isn't fetched again unless someone adds it by hand.
 */
export const deleteStoredMatch = async (ctx: Context, id: string) => {
  const { db, demos, log } = ctx
  const [row] = await db
    .select({ status: match.status, demoKey: match.demoKey })
    .from(match)
    .where(eq(match.id, id))
  if (!row) return 'not_found' as const
  // Workers mid-step would fail on the missing rows, or re-create objects after the delete.
  if (isProcessingStatus(row.status)) return 'processing' as const
  const [queued] = await db
    .select({ id: highlight.id })
    .from(highlight)
    .where(and(eq(highlight.matchId, id), eq(highlight.status, 'queued')))
    .limit(1)
  if (queued) return 'processing' as const

  const clipKeys = await db
    .select({ videoKey: clip.videoKey, thumbnailKey: clip.thumbnailKey })
    .from(clip)
    .innerJoin(highlight, eq(highlight.id, clip.highlightId))
    .where(eq(highlight.matchId, id))
  await db.delete(match).where(eq(match.id, id))

  if (row.demoKey)
    await demos
      .delete(row.demoKey)
      .catch((error) => log.warn({ error: String(error), matchId: id }, 'demo delete failed'))
  await deleteUnreferenced(
    ctx,
    clipKeys.flatMap((c) => [c.videoKey, c.thumbnailKey]),
  )
  return 'deleted' as const
}
