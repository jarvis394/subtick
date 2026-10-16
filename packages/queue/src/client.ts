import { type Job, Queue, Worker, type WorkerOptions } from 'bullmq'
import { RedisClient } from 'bun'
import { defaultJobOptions, type JobPayload, type QueueName, queues } from './registry'

export type TypedQueue<N extends QueueName> = Queue<JobPayload<N>, void, N>
export type TypedJob<N extends QueueName> = Job<JobPayload<N>, void, N>

/** BullMQ talks to Bun's native Redis client directly; each queue/worker gets its own connection. */
const connect = (redisUrl: string) => new RedisClient(redisUrl)

export const createQueue = <N extends QueueName>(name: N, redisUrl: string): TypedQueue<N> =>
  new Queue(name, { connection: connect(redisUrl), defaultJobOptions: defaultJobOptions(name) })

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
  processor: (job: TypedJob<N>) => Promise<void>,
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
