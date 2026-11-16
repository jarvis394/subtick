import { DelayedError } from 'bullmq'
import { closeOnSignal, createWorker } from '@subtick/queue'
import { staleWindowsBinaries } from './cs2/build'
import { installConfig } from './cs2/config'
import { createContext } from './context'
import { failureReason } from './failure'
import { installedHlae, needsHlaeUpdate, writeHlaeTarget } from './hlae'
import { checkRedis, checkSubtick, redactUrl } from './reachability'
import { RECORDER_VERSION, recordMatch } from './record'

const ctx = createContext()
const { env, log, api, recorder, fleet, status } = ctx

await checkRedis(env.REDIS_URL).catch((error: Error) => {
  log.fatal(
    `Redis at ${redactUrl(env.REDIS_URL)}: ${error.message}. This machine must reach the instance's Redis (see \`doctor\`)`,
  )
  process.exit(1)
})

// Unreachable is waited out like any heartbeat; a token subtick refuses won't get better.
await checkSubtick(env.SUBTICK_URL, env.RECORDER_TOKEN).catch((error: Error) => {
  if (!error.message.includes('RECORDER_TOKEN')) return
  log.fatal(error.message)
  process.exit(1)
})

// The look of every clip (HUD, demo UI, video settings) ships with the code, not the prefix.
await installConfig(ctx.layout.configDir, ctx.resolution)

Object.assign(status, await installedHlae(ctx.layout.hlaeDir))

const worker = createWorker(
  'clip.record',
  env.REDIS_URL,
  async (job, token) => {
    const stale =
      env.CS2_SERVER_DIR && (await staleWindowsBinaries(ctx.layout.cs2Dir, env.CS2_SERVER_DIR))
    const update = await pendingHlaeUpdate()
    if (stale || update) {
      // Back in the queue without using up an attempt; the container's restart policy reruns the
      // bootstrap, which downloads the Windows binaries for the server's new build or the HLAE build.
      if (stale)
        log.warn(
          stale,
          'the CS2 server updated past the Windows binaries; restarting to fetch them',
        )
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
    // Jobs are taken only once subtick said the machine isn't paused.
    autorun: false,
  },
)

let hlaeUpdateRefused = false

/** Writes the HLAE build an admin picked for the bootstrap, when it isn't what's installed. */
async function pendingHlaeUpdate() {
  // Only the container's bootstrap installs a staged build; on Windows, rerun `setup`.
  if (ctx.layout.gameHost !== 'wine') return false
  const target = fleet.settings?.hlaeTarget
  if (!needsHlaeUpdate(target, status, env.HLAE_POV)) return false
  try {
    if (await writeHlaeTarget(env.WINEPREFIX, target)) {
      log.info(target, 'restarting to install the HLAE build picked in subtick')

      return true
    }
    // Staged before and still not installed: the bootstrap turned it down, so don't loop.
    if (!hlaeUpdateRefused) log.warn(target, 'the bootstrap did not install the HLAE build')
    hlaeUpdateRefused = true
  } catch (error) {
    log.error({ target }, 'could not stage the HLAE update', error)
  }

  return false
}

worker.on('failed', async (job, error) => {
  const matchId = job?.data.matchId
  log.error({ matchId, jobId: job?.id, attempt: job?.attemptsMade }, 'record job failed', error)
  status.lastError = error.message
  status.failStreak++
  // The game may be wedged; the next job starts it fresh.
  await recorder.reset()
  const exhausted =
    job && (job.attemptsMade >= (job.opts.attempts ?? 1) || error.name === 'UnrecoverableError')
  // Event handlers aren't awaited: a rejection here (e.g. Redis briefly gone) would kill the process.
  if (matchId && exhausted)
    await api
      .failJob({
        matchId,
        highlightIds: job.data.highlightIds,
        error: error.message.slice(0, 2000),
        reason: failureReason('job', error),
      })
      .catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
})

const run = () => {
  if (worker.isRunning()) return
  log.info('taking jobs')
  worker.run().catch((error: Error) => log.error('worker stopped', error))
}

fleet.onSettings(async (settings) => {
  // Between jobs the update can't cut anything off; mid-job it waits for the next one.
  if (status.state === 'idle' && (await pendingHlaeUpdate())) {
    await worker.close()
    process.exit(1)
  }
  if (!settings.paused) run()
  if (worker.isRunning() && settings.paused !== worker.isPaused()) {
    log.info({ paused: settings.paused }, settings.paused ? 'pausing' : 'resuming')
    // Pausing lets the running job finish.
    if (settings.paused) void worker.pause()
    else worker.resume()
  }
})

status.state = 'idle'
// Returns after the first heartbeat; with subtick unreachable, jobs wait until it answers.
await fleet.start()

closeOnSignal(worker, { close: async () => fleet.stop() })

log.info({ version: RECORDER_VERSION, subtick: env.SUBTICK_URL }, 'recorder worker started')
