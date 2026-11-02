import { OVERTIME_ROUNDS, REGULATION_ROUNDS, ROUNDS_PER_HALF } from './rules'

export const MATCH_STATUSES = [
  'queued',
  'resolving',
  'downloading',
  'parsing',
  'recording',
  'ready',
  'failed',
  'expired',
] as const

export type MatchStatus = (typeof MATCH_STATUSES)[number]

/** Statuses a match is still moving through the pipeline in. */
export const PROCESSING_STATUSES = [
  'queued',
  'resolving',
  'downloading',
  'parsing',
  'recording',
] as const satisfies readonly MatchStatus[]

export const isProcessingStatus = (status: MatchStatus) =>
  (PROCESSING_STATUSES as readonly MatchStatus[]).includes(status)

/**
 * A match someone stopped is `failed` with this error, so Retry picks it up again from the stage
 * it stopped at. Workers check for it between steps and leave the match alone.
 */
export const CANCELLED_ERROR = 'Cancelled'

export const isCancelled = (row: { status: MatchStatus; error: string | null }) =>
  row.status === 'failed' && row.error === CANCELLED_ERROR

/** Rounds a team needs to win the match, given how many rounds were played before this one. */
export const winsNeeded = (roundsPlayed: number) => {
  if (roundsPlayed < REGULATION_ROUNDS) return ROUNDS_PER_HALF + 1
  const overtime = Math.floor((roundsPlayed - REGULATION_ROUNDS) / OVERTIME_ROUNDS) + 1

  return ROUNDS_PER_HALF + (OVERTIME_ROUNDS / 2) * overtime + 1
}

/** First round of each half (and of each overtime half) is a pistol round in regulation only. */
export const isPistolRound = (round: number) => round === 1 || round === ROUNDS_PER_HALF + 1

export const isOvertimeRound = (round: number) => round > REGULATION_ROUNDS
