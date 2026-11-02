import { type Job, Queue, Worker, type WorkerOptions, createBunRedisClient } from 'bullmq'
import { RedisClient } from 'bun'
import { defaultJobOptions, type JobPayload, type QueueName, queues } from './registry'

export type TypedQueue<N extends QueueName> = Queue<JobPayload<N>, void, N>
export type TypedJob<N extends QueueName> = Job<JobPayload<N>, void, N>

/**
 * BullMQ over Bun's Redis client, one connection per queue/worker. It must be wrapped: BullMQ otherwise
 * treats the object as connection options and silently falls back to ioredis on 127.0.0.1:6379.
 * Bun stops after 20 reconnects, leaving a worker deaf to its queue, and Redis can be gone for hours
 * (the recorder reaches it over an SSH tunnel), so retry forever with backoff.
 */
const connect = (redisUrl: string) =>
  createBunRedisClient(new RedisClient(redisUrl, { maxRetries: 1_000_000 }))

export const createQueue = <N extends QueueName>(name: N, redisUrl: string): TypedQueue<N> =>
  new Queue(name, { connection: connect(redisUrl), defaultJobOptions: defaultJobOptions(name) })

/** States of a job no worker has picked up yet, which can be removed outright. */
export const PENDING_STATES = ['waiting', 'prioritized', 'delayed'] as const

export const enqueue = <N extends QueueName>(
  queue: TypedQueue<N>,
  payload: JobPayload<N>,
  options: { priority?: number; delay?: number } = {},
) => {
  const name = queue.name as N

  return queue.add(name as never, payload as never, {
    ...options,
    jobId: queues[name].jobId(payload),
  })
}

/**
 * Enqueues work that already ran. Finished and failed jobs are kept for a while under their
 * deterministic id, and `enqueue` would dedupe against them; this removes such a job first. Work
 * still waiting or running is left as it is.
 */
export const requeue = async <N extends QueueName>(
  queue: TypedQueue<N>,
  payload: JobPayload<N>,
  options: { priority?: number; delay?: number } = {},
) => {
  const name = queue.name as N
  const existing = await queue.getJob(queues[name].jobId(payload))
  if (existing) {
    const state = await existing.getState()
    if (state !== 'completed' && state !== 'failed' && state !== 'unknown') return existing
    await existing.remove()
  }

  return enqueue(queue, payload, options)
}

export const enqueueBulk = <N extends QueueName>(
  queue: TypedQueue<N>,
  payloads: JobPayload<N>[],
) => {
  const name = queue.name as N

  return queue.addBulk(
    payloads.map((data) => ({ name, data, opts: { jobId: queues[name].jobId(data) } })) as never,
  )
}

export const createWorker = <N extends QueueName>(
  name: N,
  redisUrl: string,
  processor: (job: TypedJob<N>, token?: string) => Promise<void>,
  options: Omit<WorkerOptions, 'connection'> = {},
): Worker<JobPayload<N>, void, N> =>
  new Worker(name, processor, { ...options, connection: connect(redisUrl) })

/** Closes workers/queues on SIGINT/SIGTERM so in-flight jobs finish instead of stalling. */
export const closeOnSignal = (...closables: { close(): Promise<void> }[]) => {
  const shutdown = async () => {
    await Promise.allSettled(closables.map((c) => c.close()))
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
