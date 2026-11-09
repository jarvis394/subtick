import type { MatchResult } from '@subtick/domain'
import type { Player } from '@/lib/queries'

export type Played = Player['history'][number]

export const RESULT_LABEL: Record<MatchResult, string> = { win: 'Won', loss: 'Lost', draw: 'Draw' }

export const ratingTone = (rating: number) =>
  rating >= 1.15 ? 'text-success' : rating < 0.85 ? 'text-danger' : undefined

export const impactTone = (impact: number) =>
  impact > 0 ? 'text-success' : impact < 0 ? 'text-danger' : undefined

export const formatImpact = (impact: number) => `${impact > 0 ? '+' : ''}${impact.toFixed(1)}`

/** `matches` must not be empty. */
export const bestMatch = (matches: Played[]) =>
  matches.reduce((top, m) => (m.stats.rating > top.stats.rating ? m : top))
