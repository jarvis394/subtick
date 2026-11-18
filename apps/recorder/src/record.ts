/* oxlint-disable no-await-in-loop -- one game instance records clips (and their parts) one after another */
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type RecorderClip,
  clipOffsetTicks,
  clipSegments,
  segmentsTicks,
  ticksToSeconds,
} from '@subtick/domain'
import type { ClipPhase, TypedJob } from '@subtick/queue'
import { SubtickApiError, download, upload } from './api'
import type { Context } from './context'
import { failureReason } from './failure'
import { finishClip, joinParts, probe, thumbnail } from './post'
import type { RecordedFile } from './recorder'

/** Bumped when clips should be re-rendered (look, resolution, capture changes). */
export const RECORDER_VERSION = 5

/** Of a clip's time in the batch, the share spent capturing frames rather than encoding them. */
const CAPTURE_SHARE = 0.85

/** Tries per clip, each in a fresh game after the first fails. */
const CAPTURE_ATTEMPTS = 2

/** An admin killed CS2 mid-job; the job goes back in the queue. */
export class GameKilledError extends Error {
  constructor() {
    super('CS2 was killed from subtick')
  }
}

/**
 * One job per match batch: load the demo once, then record its highlights in demo order, so each
 * seek is short. A clip that fails is marked failed and the game restarted; the batch goes on.
 * Failing to load the demo at all fails the job, which BullMQ retries.
 */
export const recordMatch = async (ctx: Context, job: TypedJob<'clip.record'>) => {
  const { api, recorder, env, log } = ctx
  const { matchId, highlightIds } = job.data
  const batch = await api.startJob({ matchId, highlightIds, recorderVersion: RECORDER_VERSION })
  if (!batch) {
    log.info({ matchId }, 'nothing to record')

    return
  }
  const pending = batch.clips

  const work = join(env.SCRATCH_DIR, 'recorder', matchId)

  /**
   * Where the batch is, for the Queue page: the match's share of clips done (a clip's capture is
   * most of its time; encoding and upload the rest), and the clip's own phase and frames.
   */
  const report = (index: number, id: string, phase: ClipPhase, progress?: number) => {
    const within =
      phase === 'recording'
        ? CAPTURE_SHARE * (progress ?? 0)
        : phase === 'rendering'
          ? CAPTURE_SHARE
          : 0
    const value = (index + within) / pending.length
    const onClip = { id, phase, progress }

    return Promise.all([
      ctx.progress(matchId, value, onClip),
      job.updateProgress({ value, clip: onClip }),
    ])
  }

  await mkdir(work, { recursive: true })
  try {
    await report(0, pending[0]!.id, 'loading')
    const demoPath = join(work, 'demo.dem')
    await Bun.write(demoPath, await Bun.zstdDecompress(await download(batch.demoUrl)))

    for (const [index, h] of pending.entries()) {
      if (ctx.killSwitch.on) throw new GameKilledError()
      // Cancelled while earlier clips recorded: it went back to being a candidate.
      if (!(await api.isQueued(h.id))) continue
      let raw: RecordedFile | undefined

      const fail = async (stage: 'capture' | 'delivery', error: unknown) => {
        const reason = failureReason(stage, error)
        log.error({ matchId, highlightId: h.id, stage }, 'clip failed', error)
        ctx.status.failStreak++
        ctx.status.lastError = reason
        await api.clipFailed(h.id, reason)
      }

      const capture = async () => {
        // The game keeps the previous job's demo loaded; never record this match's ticks from it.
        if (recorder.loadedMatchId !== matchId) {
          await report(index, h.id, 'loading')
          await recorder.prepare({ matchId, demoPath, map: batch.map })
        }
        await report(index, h.id, 'recording', 0)

        return recorder.record({
          highlightId: h.id,
          playerName: h.playerName,
          segments: clipSegments(h),
          onProgress: (progress) => void report(index, h.id, 'recording', progress).catch(() => {}),
        })
      }

      for (let attempt = 1; !raw; attempt++) {
        try {
          raw = await capture()
        } catch (error) {
          if (ctx.killSwitch.on) throw new GameKilledError()
          // The game's state is unknown after a failed capture: start it fresh. A session that
          // slowed down mid-clip times out, so the clip gets one more try in a new game.
          await recorder.reset()
          if (attempt >= CAPTURE_ATTEMPTS) {
            await fail('capture', error)
            break
          }
          log.warn({ matchId, highlightId: h.id, attempt }, 'capture failed, retrying', error)
          if (!(await api.isQueued(h.id))) break
        }
      }
      if (!raw) continue
      await report(index, h.id, 'rendering')
      await deliverClip(ctx, h, raw, work).catch(async (error) => {
        if (!isCancelled(error)) return fail('delivery', error)
        log.info({ matchId, highlightId: h.id }, 'clip cancelled while rendering')
      })
      // The takes are not needed either way.
      await rm(raw.dir, { recursive: true, force: true })
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
  await api.finishJob(matchId)
}

/** subtick answers 410 for a clip no longer queued: cancelled, so there is nothing to save. */
const isCancelled = (error: unknown) => error instanceof SubtickApiError && error.status === 410

/** Encodes the capture for the web, uploads it with a poster, and records the clip row. */
const deliverClip = async (ctx: Context, h: RecorderClip, raw: RecordedFile, work: string) => {
  const { api, log } = ctx

  const segments = clipSegments(h)
  if (raw.parts.length !== segments.length)
    throw new Error(`${raw.parts.length} parts recorded for ${segments.length} segments`)
  // Audio only when every part has it: parts with and without an audio stream don't join.
  const withAudio = raw.parts.every((p) => p.audioPath)
  const finished: string[] = []
  for (const [i, part] of raw.parts.entries()) {
    const planned = ticksToSeconds(segments[i]!.endTick - segments[i]!.startTick)
    const captured = await probe(part.path)
    if (captured.durationMs < planned * 1000 * 0.9)
      throw new Error(
        `segment ${i} is ${captured.durationMs} ms, planned ${Math.round(planned * 1000)} ms`,
      )
    const out = join(work, `${h.id}-${i}.mp4`)
    await finishClip(part.path, withAudio ? part.audioPath : undefined, out, planned)
    finished.push(out)
  }

  const planned = ticksToSeconds(segmentsTicks(segments))
  const video = join(work, `${h.id}.mp4`)
  const poster = join(work, `${h.id}.webp`)
  await joinParts(finished, video)
  // The poster is the clip's last kill: the moment the highlight builds up to.
  const peak = h.kills.at(-1)?.tick ?? (h.startTick + h.endTick) / 2
  await thumbnail(video, poster, ticksToSeconds(clipOffsetTicks(segments, peak)) + 0.25)
  const info = await probe(video)
  const urls = await api.clipUploads(h.id)
  await upload(urls.video, video, 'video/mp4')
  await upload(urls.thumbnail, poster, 'image/webp')
  await api.clipRecorded(h.id, { ...info, recorderVersion: RECORDER_VERSION })
  ctx.status.clipsRecorded++
  ctx.status.failStreak = 0

  log.info(
    {
      matchId: h.matchId,
      highlightId: h.id,
      demoSeconds: planned,
      renderMs: raw.renderMs,
      segments: segments.length,
      audio: withAudio,
      mb: +(Bun.file(video).size / 1e6).toFixed(1),
    },
    'clip recorded',
  )
}
