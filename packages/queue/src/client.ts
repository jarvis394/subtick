import { type Job, Queue, Worker, type WorkerOptions, createBunRedisClient } from 'bullmq'
import { createLogger } from '@subtick/logger'
import { createRedisClient, isConnectionError, reportDown, watchConnection } from './connection'
import { defaultJobOptions, type JobPayload, type QueueName, queues } from './registry'

export type TypedQueue<N extends QueueName> = Queue<JobPayload<N>, void, N>
export type TypedJob<N extends QueueName> = Job<JobPayload<N>, void, N>

const log = createLogger('queue')

/**
 * BullMQ over Bun's Redis client, one connection per queue/worker. It must be wrapped: BullMQ otherwise
 * treats the object as connection options and silently falls back to ioredis on 127.0.0.1:6379.
 */
const connect = (redisUrl: string) => {
  const raw = createRedisClient(redisUrl)
  const client = createBunRedisClient(raw)
  client.once('end', watchConnection(raw, redisUrl))

  return client
}

/** Without a listener BullMQ prints every error, once per retry while Redis is gone. */
const reportError = (redisUrl: string, queue: string) => (error: Error) =>
  isConnectionError(error)
    ? reportDown(redisUrl, error)
    : log.error({ queue }, 'queue error', error)

export const createQueue = <N extends QueueName>(name: N, redisUrl: string): TypedQueue<N> => {
  const queue: TypedQueue<N> = new Queue(name, {
    connection: connect(redisUrl),
    defaultJobOptions: defaultJobOptions(name),
  })
  queue.on('error', reportError(redisUrl, name))

  return queue
}

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
): Worker<JobPayload<N>, void, N> => {
  const worker = new Worker(name, processor, { ...options, connection: connect(redisUrl) })
  worker.on('error', reportError(redisUrl, name))

  return worker
}

/** Closes workers/queues on SIGINT/SIGTERM so in-flight jobs finish instead of stalling. */
export const closeOnSignal = (...closables: { close(): Promise<void> }[]) => {
  const shutdown = async () => {
    await Promise.allSettled(closables.map((c) => c.close()))
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
