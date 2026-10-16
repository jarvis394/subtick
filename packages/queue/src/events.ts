import type { MatchStatus } from '@subtick/domain'
import { RedisClient } from 'bun'

export const MATCH_EVENTS_CHANNEL = 'subtick:match-events'

export interface MatchEvent {
  matchId: string
  status: MatchStatus
  /** 0..1 within the current status, when the stage can report it. */
  progress?: number
}

/** Pipeline progress, fanned out to browsers by the api over SSE. */
export const createMatchEventPublisher = (redisUrl: string) => {
  const redis = new RedisClient(redisUrl)
  return (event: MatchEvent) => redis.publish(MATCH_EVENTS_CHANNEL, JSON.stringify(event))
}
