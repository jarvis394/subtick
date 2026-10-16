import type { DefaultJobOptions } from 'bullmq'

/**
 * Every job carries IDs only. Workers load current state from Postgres, so a retried job can
 * never act on a stale payload.
 */
export interface JobPayloads {
  'steam.sync-user': { steamId: string }
  'steam.resolve-match': { shareCode: string; userId?: string; steamId?: string }
  'demo.download': { matchId: string }
  'demo.parse': { matchId: string }
  'clip.record': { matchId: string; highlightIds: string[] }
  'clip.reel': { matchId: string; steamId: string }
}

export type QueueName = keyof JobPayloads
export type JobPayload<N extends QueueName> = JobPayloads[N]

interface QueueDefinition<N extends QueueName> {
  /** Deterministic job id: enqueueing the same work twice is a no-op while the job exists. */
  jobId: (payload: JobPayload<N>) => string
  options: DefaultJobOptions
}

const exponential = (delay: number) => ({ type: 'exponential', delay }) as const

// BullMQ custom ids must not be plain integers and must not contain ':'.
export const queues: { [N in QueueName]: QueueDefinition<N> } = {
  'steam.sync-user': {
    jobId: ({ steamId }) => `sync-${steamId}`,
    options: { attempts: 5, backoff: exponential(30_000) },
  },
  'steam.resolve-match': {
    jobId: ({ shareCode }) => `resolve-${shareCode}`,
    options: { attempts: 5, backoff: exponential(60_000) },
  },
  'demo.download': {
    jobId: ({ matchId }) => `download-${matchId}`,
    options: { attempts: 3, backoff: exponential(60_000) },
  },
  'demo.parse': {
    jobId: ({ matchId }) => `parse-${matchId}`,
    options: { attempts: 2, backoff: exponential(10_000) },
  },
  'clip.record': {
    jobId: ({ matchId, highlightIds }) =>
      `record-${matchId}-${Bun.hash(highlightIds.toSorted().join()).toString(36)}`,
    options: { attempts: 2, backoff: exponential(30_000) },
  },
  'clip.reel': {
    jobId: ({ matchId, steamId }) => `reel-${matchId}-${steamId}`,
    options: { attempts: 2 },
  },
}

const COMMON_OPTIONS: DefaultJobOptions = {
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
}

export const defaultJobOptions = (name: QueueName): DefaultJobOptions => ({
  ...COMMON_OPTIONS,
  ...queues[name].options,
})
