import { decodeShareCode } from '@subtick/domain'
import { type QueueName, type TypedJob, closeOnSignal, createWorker } from '@subtick/queue'
import type { WorkerOptions } from 'bullmq'
import { createContext } from './context'
import { downloadDemo } from './download'
import { resolveMatch } from './resolve'
import { scheduleSyncs, syncUser } from './sync'

const ctx = await createContext()
const { env, log, queues } = ctx

const SCHEDULE_EVERY_MS = 60_000

/** The match a job is about, if any, so a job that runs out of retries can fail its match. */
const matchIdOf = (data: { matchId?: string; shareCode?: string }) =>
  data.matchId ?? (data.shareCode && decodeShareCode(data.shareCode).matchId.toString())

const start = <N extends QueueName>(
  name: N,
  processor: (job: TypedJob<N>) => Promise<void>,
  options?: Omit<WorkerOptions, 'connection'>,
) => {
  const worker = createWorker(name, env.REDIS_URL, processor, options)
  worker.on('failed', async (job, error) => {
    const data = (job?.data ?? {}) as { matchId?: string; shareCode?: string; steamId?: string }
    const matchId = matchIdOf(data)
    log.error(
      { queue: name, jobId: job?.id, attempt: job?.attemptsMade, matchId, steamId: data.steamId },
      'job failed',
      error,
    )
    // Out of retries: put the match in a terminal state so the UI stops showing it as pending.
    const exhausted =
      job && (job.attemptsMade >= (job.opts.attempts ?? 1) || error.name === 'UnrecoverableError')
    // Event handlers aren't awaited: a rejection here (e.g. Redis briefly gone) would kill the
    // process.
    if (matchId && exhausted)
      await ctx
        .setStatus(matchId, 'failed', error.message)
        .catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
  })
  return worker
}

await queues.schedule.upsertJobScheduler(
  'steam.schedule',
  { every: SCHEDULE_EVERY_MS },
  { name: 'steam.schedule', data: {} },
)

const workers = [
  start('steam.schedule', () => scheduleSyncs(ctx)),
  // Valve's Web API allows ~100k calls a day; a handful per second is plenty.
  start('steam.sync-user', (job) => syncUser(ctx, job), {
    concurrency: 4,
    limiter: { max: 5, duration: 1000 },
  }),
  start('demo.download', (job) => downloadDemo(ctx, job), {
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: 5 * 60_000,
  }),
]

// One GC session answers one request at a time; more throughput needs more bots. Without a bot,
// resolve jobs wait in the queue until one is configured.
const { gc } = ctx
const resolver =
  gc &&
  start('steam.resolve-match', (job) => resolveMatch(ctx, gc, job), {
    concurrency: 1,
    limiter: { max: 1, duration: 1000 },
  })
if (!gc) log.warn('no Steam bot configured: share codes wait for STEAM_BOT_USERNAME/PASSWORD')

closeOnSignal(...workers, ...(resolver ? [resolver] : []), ...Object.values(queues), {
  close: async () => gc?.close(),
})
log.info({ gc: Boolean(gc), downloadConcurrency: env.WORKER_CONCURRENCY }, 'steam worker started')
