/* oxlint-disable no-await-in-loop -- one game instance records clips one after another */
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { and, asc, eq, inArray, schema } from '@subtick/db'
import { ticksToSeconds } from '@subtick/domain'
import type { TypedJob } from '@subtick/queue'
import { keys } from '@subtick/storage'
import type { Context } from './context'
import { finishClip, probe, thumbnail } from './post'
import type { RecordedFile } from './recorder'

const { match, highlight, matchPlayer, clip } = schema

/** Bumped when clips should be re-rendered (look, resolution, capture changes). */
export const RECORDER_VERSION = 2

type Highlight = typeof highlight.$inferSelect

/**
 * One job per match batch: load the demo once, then record its highlights in demo order, so each
 * seek is short. A clip that fails is marked failed and the game restarted; the batch goes on.
 * Failing to load the demo at all fails the job, which BullMQ retries.
 */
export const recordMatch = async (ctx: Context, job: TypedJob<'clip.record'>) => {
  const { db, demos, recorder, env, log } = ctx
  const { matchId, highlightIds } = job.data
  const [row] = await db.select().from(match).where(eq(match.id, matchId))
  if (!row) return
  if (!row.demoKey) {
    // Nothing to play back (e.g. a match seeded from a local file): its stats stand on their own.
    await db
      .update(highlight)
      .set({ status: 'skipped' })
      .where(and(inArray(highlight.id, highlightIds), eq(highlight.status, 'queued')))
    log.warn({ matchId }, 'no stored demo, highlights skipped')
    return finishMatch(ctx, matchId)
  }

  const todo = await db
    .select({ highlight, playerName: matchPlayer.name, recordedBy: clip.recorderVersion })
    .from(highlight)
    .leftJoin(
      matchPlayer,
      and(eq(matchPlayer.matchId, highlight.matchId), eq(matchPlayer.steamId, highlight.steamId)),
    )
    .leftJoin(clip, eq(clip.highlightId, highlight.id))
    .where(inArray(highlight.id, highlightIds))
    .orderBy(asc(highlight.startTick))
  // A retried job skips what an earlier attempt already rendered.
  const pending = todo.filter((t) => (t.recordedBy ?? -1) < RECORDER_VERSION)
  const current = todo.filter((t) => !pending.includes(t)).map((t) => t.highlight.id)
  if (current.length)
    await db.update(highlight).set({ status: 'recorded' }).where(inArray(highlight.id, current))

  const work = join(env.SCRATCH_DIR, 'recorder', matchId)
  await mkdir(work, { recursive: true })
  try {
    if (pending.length) {
      await ctx.setStatus(matchId, 'recording')
      const demoPath = join(work, 'demo.dem')
      await demos.download(keys.demo(matchId), `${demoPath}.zst`)
      await Bun.write(demoPath, await Bun.zstdDecompress(await Bun.file(`${demoPath}.zst`).bytes()))
      await rm(`${demoPath}.zst`)

      for (const [index, { highlight: h, playerName }] of pending.entries()) {
        await ctx.progress(matchId, index / pending.length)
        // The game keeps the previous job's demo loaded; never record this match's ticks from it.
        if (recorder.loadedMatchId !== matchId)
          await recorder.prepare({ matchId, demoPath, map: row.map ?? '' })
        const fail = async (stage: string, error: unknown) => {
          log.error({ matchId, highlightId: h.id, stage }, 'clip failed', error)
          await db.update(highlight).set({ status: 'failed' }).where(eq(highlight.id, h.id))
        }
        let raw: RecordedFile
        try {
          raw = await recorder.record({
            highlightId: h.id,
            playerName: playerName ?? '',
            startTick: h.startTick,
            endTick: h.endTick,
          })
        } catch (error) {
          await fail('capture', error)
          // The game's state is unknown after a failed capture: start it fresh.
          await recorder.reset()
          continue
        }
        await deliverClip(ctx, h, raw, work).catch((error) => fail('delivery', error))
        // The take folder (`<takes>/<highlightId>/takeNNNN/video.mp4`) is not needed either way.
        await rm(dirname(dirname(raw.path)), { recursive: true, force: true })
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
  await finishMatch(ctx, matchId)
}

/** Encodes the capture for the web, uploads it with a poster, and records the clip row. */
const deliverClip = async (ctx: Context, h: Highlight, raw: RecordedFile, work: string) => {
  const { db, clips, log } = ctx

  const planned = ticksToSeconds(h.endTick - h.startTick)
  const captured = await probe(raw.path)
  if (captured.durationMs < planned * 1000 * 0.9)
    throw new Error(
      `capture is ${captured.durationMs} ms, planned ${Math.round(planned * 1000)} ms`,
    )

  const video = join(work, `${h.id}.mp4`)
  const poster = join(work, `${h.id}.jpg`)
  await finishClip(raw.path, raw.audioPath, video, planned)
  // The poster is the clip's last kill: the moment the highlight builds up to.
  const peak = h.kills.at(-1)?.tick ?? (h.startTick + h.endTick) / 2
  await thumbnail(video, poster, ticksToSeconds(peak - h.startTick) + 0.25)
  const info = await probe(video)
  await clips.put(keys.clip(h.id), Bun.file(video), 'video/mp4')
  await clips.put(keys.thumbnail(h.id), Bun.file(poster), 'image/jpeg')
  const values = {
    videoKey: keys.clip(h.id),
    thumbnailKey: keys.thumbnail(h.id),
    ...info,
    recorderVersion: RECORDER_VERSION,
    createdAt: new Date(),
  }
  await db
    .insert(clip)
    .values({ highlightId: h.id, ...values })
    .onConflictDoUpdate({ target: clip.highlightId, set: values })
  await db.update(highlight).set({ status: 'recorded' }).where(eq(highlight.id, h.id))
  ctx.status.clipsRecorded++

  log.info(
    {
      matchId: h.matchId,
      highlightId: h.id,
      demoSeconds: planned,
      renderMs: raw.renderMs,
      audio: Boolean(raw.audioPath),
      mb: +(Bun.file(video).size / 1e6).toFixed(1),
    },
    'clip recorded',
  )
}

/** A match is ready once none of its highlights is still waiting to be recorded. */
const finishMatch = async (ctx: Context, matchId: string) => {
  const waiting = await ctx.db
    .select({ id: highlight.id })
    .from(highlight)
    .where(and(eq(highlight.matchId, matchId), eq(highlight.status, 'queued')))
    .limit(1)
  const [row] = await ctx.db
    .select({ status: match.status })
    .from(match)
    .where(eq(match.id, matchId))
  if (!waiting.length && row?.status === 'recording') await ctx.setStatus(matchId, 'ready')
}
