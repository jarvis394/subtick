import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, inArray, schema } from '@subtick/db'
import { closeOnSignal, createWorker } from '@subtick/queue'
import { createContext } from './context'
import { RECORDER_VERSION, recordMatch } from './record'

const ctx = createContext()
const { env, log, recorder, game, fleet, status } = ctx

// The look of every clip (HUD, demo UI, video settings) ships with the code, not the prefix.
await cp(new URL('../cfg', import.meta.url).pathname, join(ctx.configDir, 'cfg'), {
  recursive: true,
})

/** Jobs and account switches both drive the one game client: never at the same time. */
let lane: Promise<unknown> = Promise.resolve()
const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
  const run = lane.then(task)
  lane = run.catch(() => {})
  return run
}

/**
 * Signs Steam in with the account an admin assigned, switching accounts if another one is signed
 * in. Runs between jobs; a sign-in can wait several minutes for an emailed Steam Guard code.
 */
const syncSteamAccount = async () => {
  const wanted = fleet?.settings?.steamAccount?.username
  status.signedInAs = await game.signedInAs()
  // An emulated Steam has no accounts to switch between.
  if (env.STEAM_MODE === 'emulator' || !wanted || status.signedInAs === wanted) return
  log.info({ from: status.signedInAs, to: wanted }, 'switching Steam account')
  status.state = 'signing_in'
  await recorder.reset()
  await game.signOut()
  try {
    await game.signIn()
    status.lastError = null
  } finally {
    status.signedInAs = await game.signedInAs()
  }
}

const worker = createWorker(
  'clip.record',
  env.REDIS_URL,
  (job) =>
    exclusive(async () => {
      status.currentMatchId = job.data.matchId
      try {
        await syncSteamAccount()
        status.state = 'recording'
        await recordMatch(ctx, job)
        status.lastError = null
      } finally {
        status.state = 'idle'
        status.currentMatchId = null
        status.signedInAs = await game.signedInAs()
      }
    }),
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
        .set({ status: 'failed' })
        .where(
          and(
            inArray(schema.highlight.id, job.data.highlightIds),
            eq(schema.highlight.status, 'queued'),
          ),
        ),
    ]).catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
})

if (fleet) {
  let switching = false
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
    // A new account is signed in right away when idle, so the admin sees it work (or the code
    // prompt) without waiting for a job.
    const wanted = settings.steamAccount?.username
    if (env.STEAM_MODE === 'emulator') return
    if (!wanted || wanted === status.signedInAs || switching || status.state !== 'idle') return
    switching = true
    void exclusive(syncSteamAccount)
      .catch((error: Error) => {
        log.error('could not sign the new Steam account in', error)
        status.lastError = error.message
      })
      .finally(() => {
        switching = false
        if (status.state === 'signing_in' || status.state === 'needs_guard_code')
          status.state = status.lastError ? 'error' : 'idle'
        void fleet.report()
      })
  })
}

status.signedInAs = await game.signedInAs()
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
