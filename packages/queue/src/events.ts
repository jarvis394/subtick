import type { MatchStatus } from '@subtick/domain'
import { RedisClient } from 'bun'

export const MATCH_EVENTS_CHANNEL = 'subtick:match-events'

export interface MatchEvent {
  matchId: string
  status: MatchStatus
  /** 0..1 within the current status, when the stage can report it. */
  progress?: number
  /** While recording: the clip the recorder is on and how far it is. */
  clip?: ClipProgress
}

/** Where one clip is in the recorder: loading the demo, capturing frames, or encoding them. */
export type ClipPhase = 'loading' | 'recording' | 'rendering'

export interface ClipProgress {
  id: string
  phase: ClipPhase
  /** 0..1 of the clip's frames captured, while `recording`. */
  progress?: number
}

/** Pipeline progress, fanned out to browsers by the api over SSE. */
export const createMatchEventPublisher = (redisUrl: string) => {
  const redis = new RedisClient(redisUrl)
  return (event: MatchEvent) => redis.publish(MATCH_EVENTS_CHANNEL, JSON.stringify(event))
}

/**
 * One Redis subscription per process, fanned out to in-process listeners (one per SSE client).
 * Returns `listen(fn) → unlisten`.
 */
export const createMatchEventHub = (redisUrl: string) => {
  const listeners = new Set<(event: MatchEvent) => void>()
  let subscribed: Promise<unknown> | null = null
  const redis = new RedisClient(redisUrl)

  return (listener: (event: MatchEvent) => void) => {
    listeners.add(listener)
    subscribed ??= redis.subscribe(MATCH_EVENTS_CHANNEL, (message) => {
      const event = JSON.parse(message) as MatchEvent
      for (const fn of listeners) fn(event)
    })
    return () => listeners.delete(listener)
  }
}
