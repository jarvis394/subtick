import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, inArray, schema } from '@subtick/db'
import { DelayedError } from 'bullmq'
import { closeOnSignal, createWorker } from '@subtick/queue'
import { staleWindowsBinaries } from './cs2/build'
import { createContext } from './context'
import { failureReason } from './failure'
import { RECORDER_VERSION, recordMatch } from './record'

const ctx = createContext()
const { env, log, recorder, fleet, status } = ctx

// The look of every clip (HUD, demo UI, video settings) ships with the code, not the prefix.
await cp(new URL('../cfg', import.meta.url).pathname, join(ctx.configDir, 'cfg'), {
  recursive: true,
})

const worker = createWorker(
  'clip.record',
  env.REDIS_URL,
  async (job, token) => {
    const stale =
      env.CS2_SERVER_DIR && (await staleWindowsBinaries(env.CS2_DIR, env.CS2_SERVER_DIR))
    if (stale) {
      // Back in the queue without using up an attempt; the container's restart policy reruns the
      // bootstrap, which downloads the Windows binaries for the server's new build.
      log.warn(stale, 'the CS2 server updated past the Windows binaries; restarting to fetch them')
      void worker.close().then(() => process.exit(1))
      await job.moveToDelayed(Date.now() + 60_000, token)
      throw new DelayedError()
    }
    status.currentMatchId = job.data.matchId
    status.state = 'recording'
    try {
      await recordMatch(ctx, job)
      status.lastError = null
    } finally {
      status.state = 'idle'
      status.currentMatchId = null
    }
  },
  {
    // One game instance per GPU. Batches run for many minutes; BullMQ renews the lock meanwhile.
    concurrency: 1,
    lockDuration: 5 * 60_000,
    // In a fleet, take jobs only once subtick said the machine isn't paused.
    autorun: !fleet,
  },
)

worker.on('failed', async (job, error) => {
  const matchId = job?.data.matchId
  log.error({ matchId, jobId: job?.id, attempt: job?.attemptsMade }, 'record job failed', error)
  status.lastError = error.message
  // The game may be wedged; the next job starts it fresh.
  await recorder.reset()
  const exhausted =
    job && (job.attemptsMade >= (job.opts.attempts ?? 1) || error.name === 'UnrecoverableError')
  // Event handlers aren't awaited: a rejection here (e.g. Redis briefly gone) would kill the process.
  if (matchId && exhausted)
    await Promise.all([
      ctx.setStatus(matchId, 'failed', error.message),
      // Left `queued`, they would show as recording forever and could not be retried.
      ctx.db
        .update(schema.highlight)
        .set({ status: 'failed', error: failureReason('job', error) })
        .where(
          and(
            inArray(schema.highlight.id, job.data.highlightIds),
            eq(schema.highlight.status, 'queued'),
          ),
        ),
    ]).catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
})

if (fleet) {
  const run = () => {
    if (worker.isRunning()) return
    log.info('taking jobs')
    worker.run().catch((error: Error) => log.error('worker stopped', error))
  }
  fleet.onSettings((settings) => {
    if (!settings.paused) run()
    if (worker.isRunning() && settings.paused !== worker.isPaused()) {
      log.info({ paused: settings.paused }, settings.paused ? 'pausing' : 'resuming')
      // Pausing lets the running job finish.
      if (settings.paused) void worker.pause()
      else worker.resume()
    }
  })
}

status.state = 'idle'
if (fleet) {
  await fleet.start()
  // subtick is unreachable: record anyway rather than sit idle until it's back.
  if (!fleet.settings && !worker.isRunning()) {
    log.warn('no settings from subtick yet; taking jobs anyway')
    worker.run().catch((error: Error) => log.error('worker stopped', error))
  }
}
closeOnSignal(worker, { close: async () => fleet?.stop() })
log.info(
  { version: RECORDER_VERSION, fleet: fleet ? env.SUBTICK_URL : 'standalone' },
  'recorder worker started',
)
