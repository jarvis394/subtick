import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { closeOnSignal, createWorker } from '@subtick/queue'
import { createContext } from './context'
import { RECORDER_VERSION, recordMatch } from './record'

const ctx = createContext()
const { env, log, recorder } = ctx

// The look of every clip (HUD, demo UI, video settings) ships with the code, not the prefix.
await cp(new URL('../cfg', import.meta.url).pathname, join(ctx.configDir, 'cfg'), {
  recursive: true,
})

const worker = createWorker('clip.record', env.REDIS_URL, (job) => recordMatch(ctx, job), {
  // One game instance per GPU. Batches run for many minutes; BullMQ renews the lock meanwhile.
  concurrency: 1,
  lockDuration: 5 * 60_000,
})

worker.on('failed', async (job, error) => {
  const matchId = job?.data.matchId
  log.error({ matchId, jobId: job?.id, attempt: job?.attemptsMade }, 'record job failed', error)
  // The game may be wedged; the next job starts it fresh.
  await recorder.reset()
  const exhausted =
    job && (job.attemptsMade >= (job.opts.attempts ?? 1) || error.name === 'UnrecoverableError')
  // Event handlers aren't awaited: a rejection here (e.g. Redis briefly gone) would kill the process.
  if (matchId && exhausted)
    await ctx
      .setStatus(matchId, 'failed', error.message)
      .catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
})

closeOnSignal(worker)
log.info({ version: RECORDER_VERSION }, 'recorder worker started')
