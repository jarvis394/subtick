import { and, asc, eq, inArray, schema, setMatchStatus } from '@subtick/db'
import type { MatchStatus, RecorderClipUploads, RecorderJob } from '@subtick/domain'
import { keys } from '@subtick/storage'
import type { Context } from '../context'

const { match, highlight, matchPlayer, clip } = schema

type Ctx = Pick<Context, 'db' | 'publish' | 'demos' | 'clips'>

/** Long enough for a slow link to fetch a demo; the recorder downloads it as the job starts. */
const DEMO_URL_SECONDS = 3600

const setStatus = ({ db, publish }: Ctx, matchId: string, status: MatchStatus, error?: string) =>
  setMatchStatus(db, publish, matchId, status, error)

/** A match is ready once none of its highlights is still waiting to be recorded. */
export const finishRecording = async (ctx: Ctx, matchId: string) => {
  const waiting = await ctx.db
    .select({ id: highlight.id })
    .from(highlight)
    .where(and(eq(highlight.matchId, matchId), eq(highlight.status, 'queued')))
    .limit(1)
  const [row] = await ctx.db
    .select({ status: match.status })
    .from(match)
    .where(eq(match.id, matchId))
  if (!waiting.length && row?.status === 'recording') await setStatus(ctx, matchId, 'ready')
}

/**
 * What a recorder needs to run a `clip.record` job, or `null` when nothing is left to record (the
 * match is then finished here). A retried job skips what an earlier attempt already rendered, and
 * nothing cancelled is recorded.
 */
export const startRecording = async (
  ctx: Ctx,
  job: { matchId: string; highlightIds: string[]; recorderVersion: number },
): Promise<RecorderJob | null> => {
  const { db } = ctx
  const { matchId, highlightIds, recorderVersion } = job
  const [row] = await db.select().from(match).where(eq(match.id, matchId))
  if (!row) return null
  if (!row.demoKey) {
    // Nothing to play back (e.g. a match seeded from a local file): its stats stand on their own.
    await db
      .update(highlight)
      .set({ status: 'skipped' })
      .where(and(inArray(highlight.id, highlightIds), eq(highlight.status, 'queued')))
    await finishRecording(ctx, matchId)

    return null
  }

  const todo = await db
    .select({ highlight, playerName: matchPlayer.name, recordedBy: clip.recorderVersion })
    .from(highlight)
    .leftJoin(
      matchPlayer,
      and(eq(matchPlayer.matchId, highlight.matchId), eq(matchPlayer.steamId, highlight.steamId)),
    )
    .leftJoin(clip, eq(clip.highlightId, highlight.id))
    .where(and(eq(highlight.matchId, matchId), inArray(highlight.id, highlightIds)))
    .orderBy(asc(highlight.startTick))
  const pending = todo.filter(
    (t) => t.highlight.status === 'queued' && (t.recordedBy ?? -1) < recorderVersion,
  )
  const current = todo
    .filter((t) => (t.recordedBy ?? -1) >= recorderVersion)
    .map((t) => t.highlight.id)
  if (current.length)
    await db.update(highlight).set({ status: 'recorded' }).where(inArray(highlight.id, current))
  if (!pending.length) {
    await finishRecording(ctx, matchId)

    return null
  }
  await setStatus(ctx, matchId, 'recording')

  return {
    map: row.map ?? '',
    demoUrl: ctx.demos.presign(row.demoKey, DEMO_URL_SECONDS),
    clips: pending.map(({ highlight: h, playerName }) => ({
      id: h.id,
      matchId: h.matchId,
      playerName: playerName ?? '',
      startTick: h.startTick,
      endTick: h.endTick,
      segments: h.segments,
      kills: h.kills,
    })),
  }
}

/** Whether a clip is still wanted: cancelled while earlier ones recorded, it's a candidate again. */
export const isQueued = async ({ db }: Ctx, highlightId: string) => {
  const [row] = await db
    .select({ status: highlight.status })
    .from(highlight)
    .where(eq(highlight.id, highlightId))

  return row?.status === 'queued'
}

/** Upload URLs only for a clip still waiting to be recorded, so a token can't overwrite others. */
export const clipUploads = async (ctx: Ctx, highlightId: string) => {
  if (!(await isQueued(ctx, highlightId))) return null
  const uploads: RecorderClipUploads = {
    video: ctx.clips.presignPut(keys.clip(highlightId)),
    thumbnail: ctx.clips.presignPut(keys.thumbnail(highlightId)),
  }

  return uploads
}

/** Records the clip row of a still-queued highlight once both of its objects are uploaded. */
export const clipRecorded = async (
  ctx: Ctx,
  highlightId: string,
  info: { durationMs: number; width: number; height: number; recorderVersion: number },
) => {
  const { db, clips } = ctx
  const videoKey = keys.clip(highlightId)
  const thumbnailKey = keys.thumbnail(highlightId)
  if (!(await isQueued(ctx, highlightId))) return 'not_queued'
  const uploaded = await Promise.all([clips.exists(videoKey), clips.exists(thumbnailKey)])
  if (!uploaded.every(Boolean)) return 'not_uploaded'
  const values = { videoKey, thumbnailKey, ...info, createdAt: new Date() }
  await db
    .insert(clip)
    .values({ highlightId, ...values })
    .onConflictDoUpdate({ target: clip.highlightId, set: values })
  await db
    .update(highlight)
    .set({ status: 'recorded' })
    .where(and(eq(highlight.id, highlightId), eq(highlight.status, 'queued')))

  return 'recorded'
}

/** Leaves a highlight cancelled meanwhile as it is. */
export const clipFailed = ({ db }: Ctx, highlightId: string, error: string) =>
  db
    .update(highlight)
    .set({ status: 'failed', error })
    .where(and(eq(highlight.id, highlightId), eq(highlight.status, 'queued')))

/**
 * A job out of attempts: the match failed, and so did what it still had queued. Left `queued`,
 * those clips would show as recording forever and could not be retried.
 */
export const recordingFailed = async (
  ctx: Ctx,
  job: { matchId: string; highlightIds: string[]; error: string; reason: string },
) => {
  await Promise.all([
    setStatus(ctx, job.matchId, 'failed', job.error),
    ctx.db
      .update(highlight)
      .set({ status: 'failed', error: job.reason })
      .where(
        and(
          eq(highlight.matchId, job.matchId),
          inArray(highlight.id, job.highlightIds),
          eq(highlight.status, 'queued'),
        ),
      ),
  ])
}
