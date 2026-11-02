import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { eq, schema } from '@subtick/db'
import { isCancelled } from '@subtick/domain'
import { enqueue, type TypedJob } from '@subtick/queue'
import { keys } from '@subtick/storage'
import { DelayedError, UnrecoverableError } from 'bullmq'
import type { Context } from './context'
import { cancelled } from './resolve'

/** Valve deletes demos from its replay servers about a month after the match. */
const VALVE_RETENTION_MS = 30 * 24 * 3600_000
/**
 * Valve uploads the demo a while after the match ends (45 minutes seen), and its URL 404s until
 * then. A 404 this soon after the match means "not yet", so look again later.
 */
const UPLOAD_WAIT_MS = 6 * 3600_000
const UPLOAD_POLL_MS = 30_000
/** How often a running download reports progress and looks for a cancel. */
const PROGRESS_EVERY_MS = 1000
/** The fetch's share of the job; decompressing and storing the demo take the rest. */
const FETCH_SHARE = 0.9

/** Thrown out of the body loop when the match is cancelled mid-download. */
class DownloadCancelled extends Error {}

/**
 * Fetches a demo from Valve's replay servers and stores it as zstd (smaller, and far faster to
 * decompress than bzip2 for every re-parse). The job id is the match id, so a demo is never
 * downloaded twice while its job exists, and a stored demo is never fetched again.
 */
export const downloadDemo = async (
  ctx: Context,
  job: TypedJob<'demo.download'>,
  token?: string,
) => {
  const { db, demos, queues, setStatus, env, log } = ctx
  const { matchId } = job.data
  const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
  if (!row || isCancelled(row)) return
  if (row.demoKey) return void (await enqueue(queues.parse, { matchId }))
  if (!row.demoUrl) throw new UnrecoverableError(`Match ${matchId} has no demo URL`)

  await setStatus(matchId, 'downloading')
  const started = performance.now()
  const response = await fetch(row.demoUrl, { signal: AbortSignal.timeout(10 * 60_000) })
  if (response.status === 404) {
    const since = (row.playedAt ?? row.createdAt).getTime()
    if (token && Date.now() - since < UPLOAD_WAIT_MS) {
      log.info({ matchId }, 'demo not uploaded yet, looking again later')
      await setStatus(matchId, 'queued')
      await job.moveToDelayed(Date.now() + UPLOAD_POLL_MS, token)
      throw new DelayedError()
    }
    await setStatus(matchId, 'expired', 'Valve no longer has this demo')

    return
  }
  if (!response.ok || !response.body)
    throw new Error(`Demo download failed with HTTP ${response.status}`)

  const dir = join(env.SCRATCH_DIR, 'steam')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${matchId}.dem`)
  const total = Number(response.headers.get('content-length')) || 0
  let reportedAt = performance.now()

  const onChunk = async (received: number) => {
    if (performance.now() - reportedAt < PROGRESS_EVERY_MS) return
    reportedAt = performance.now()
    if (await cancelled(ctx, matchId)) throw new DownloadCancelled()
    if (!total) return
    const progress = Math.min(received / total, 1) * FETCH_SHARE
    await Promise.all([
      job.updateProgress(progress),
      ctx.publish({ matchId, status: 'downloading', progress }),
    ])
  }

  try {
    const bytes = await decompressTo(path, response, row.demoUrl.endsWith('.bz2'), onChunk)
    const compressed = await Bun.zstdCompress(await Bun.file(path).bytes(), { level: 6 })
    const key = keys.demo(matchId)
    await demos.put(key, compressed, 'application/zstd')

    const playedAt = row.playedAt ?? lastModified(response)
    await db
      .update(schema.match)
      .set({
        demoKey: key,
        playedAt,
        demoExpiresAt: playedAt ? new Date(playedAt.getTime() + VALVE_RETENTION_MS) : null,
      })
      .where(eq(schema.match.id, matchId))
    log.info(
      {
        matchId,
        mb: Math.round(bytes / 1e6),
        storedMb: Math.round(compressed.byteLength / 1e6),
        ms: Math.round(performance.now() - started),
      },
      'demo stored',
    )
  } catch (error) {
    if (!(error instanceof DownloadCancelled)) throw error
    log.info({ matchId }, 'download cancelled')

    return
  } finally {
    await Promise.all([rm(path, { force: true }), rm(`${path}.bz2`, { force: true })])
  }

  if (await cancelled(ctx, matchId)) return
  await enqueue(queues.parse, { matchId })
}

/**
 * Writes the demo to `path`, uncompressed. bzip2 goes through the system binary (Bun has no
 * bzip2 codec), run on a file: under Bun 1.3, `Bun.write(path, response)` and piping a fetch body
 * into a child's stdin both stall on Valve's replay servers, while reading the body chunk by
 * chunk does not.
 */
const decompressTo = async (
  path: string,
  response: Response,
  bzip2: boolean,
  onChunk: (received: number) => Promise<void>,
) => {
  const target = bzip2 ? `${path}.bz2` : path
  await saveBody(target, response.body!, onChunk)
  if (!bzip2) return Bun.file(path).size
  const bunzip = Bun.spawn(['bunzip2', '--force', target], { stderr: 'pipe' })
  if ((await bunzip.exited) !== 0)
    throw new Error(`bunzip2 failed: ${await new Response(bunzip.stderr).text()}`)

  return Bun.file(path).size
}

/** `onChunk` gets the bytes received so far; throwing from it stops the download. */
const saveBody = async (
  path: string,
  body: ReadableStream<Uint8Array>,
  onChunk: (received: number) => Promise<void>,
) => {
  const sink = Bun.file(path).writer()
  let received = 0
  try {
    for await (const chunk of body) {
      // oxlint-disable-next-line no-await-in-loop -- chunks arrive in order
      await sink.write(chunk)
      received += chunk.byteLength
      // oxlint-disable-next-line no-await-in-loop -- throttled inside; a cancel must stop the loop
      await onChunk(received)
    }
  } finally {
    await sink.end()
  }
}

/** Valve's replay servers stamp the demo with the time the match ended. */
const lastModified = (response: Response) => {
  const header = response.headers.get('last-modified')

  return header ? new Date(header) : null
}
