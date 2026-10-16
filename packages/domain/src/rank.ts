/** Matchmaking modes, from the `rank_type_id` CS2 reports in `rank_update`. */
export const MATCH_MODES = ['premier', 'competitive', 'wingman', 'other'] as const
export type MatchMode = (typeof MATCH_MODES)[number]

export const modeFromRankType = (rankTypeId: number): MatchMode =>
  rankTypeId === 11
    ? 'premier'
    : rankTypeId === 12
      ? 'competitive'
      : rankTypeId === 7
        ? 'wingman'
        : 'other'

/**
 * A player's rank around one match. Premier: CS Rating (0 = not yet placed).
 * Competitive/Wingman: skill group 1–18 for that map (0 = unranked).
 */
export interface PlayerRank {
  mode: MatchMode
  before: number
  after: number
  change: number
  wins: number
}

/** Premier color tiers, every 5,000 rating. */
export const PREMIER_TIERS = ['grey', 'cyan', 'blue', 'purple', 'pink', 'red', 'gold'] as const
export type PremierTier = (typeof PREMIER_TIERS)[number]

export const premierTier = (rating: number): PremierTier =>
  PREMIER_TIERS[Math.min(Math.floor(rating / 5000), PREMIER_TIERS.length - 1)]!

const SKILL_GROUPS = [
  'Silver I',
  'Silver II',
  'Silver III',
  'Silver IV',
  'Silver Elite',
  'Silver Elite Master',
  'Gold Nova I',
  'Gold Nova II',
  'Gold Nova III',
  'Gold Nova Master',
  'Master Guardian I',
  'Master Guardian II',
  'Master Guardian Elite',
  'Distinguished Master Guardian',
  'Legendary Eagle',
  'Legendary Eagle Master',
  'Supreme Master First Class',
  'Global Elite',
]

export const skillGroupName = (group: number) => SKILL_GROUPS[group - 1] ?? 'Unranked'
