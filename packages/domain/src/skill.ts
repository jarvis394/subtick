import { type LobbyTotals, type SummaryMatch, summarize, summarizeLobby } from './player-summary'
import { IMPACT_MAX, IMPACT_MIN } from './stats'
import { utilityRating } from './utility-rating'

/** Matches on each side of the comparison, once a player has that many. */
const SKILL_WINDOW = 15

/** Within this share of an area's scale, a player is level with their lobby. */
const LEVEL_SHARE = 0.03
/** A supporting stat moving by less than this share counts as flat. */
const FLAT_SHARE = 0.02

type SkillMatch = SummaryMatch & { lobby: LobbyTotals }
export type SkillArea = 'form' | 'aim' | 'utility' | 'impact'
export type SkillStanding = 'above' | 'level' | 'below'
type SkillTrend = 'up' | 'flat' | 'down'

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

const share = (part: number, whole: number) => (whole ? (part / whole) * 100 : null)

const measure = (matches: SkillMatch[]) => {
  const s = summarize(matches)
  const aims = matches.flatMap((m) => (m.stats.aim ? [m.stats.aim] : []))
  const impacts = matches.flatMap((m) => (m.stats.impact === undefined ? [] : [m.stats.impact]))

  const aimTotal = (pick: (aim: (typeof aims)[number]) => number) =>
    aims.reduce((total, aim) => total + pick(aim), 0)

  const perMatch = (total: number) => (matches.length ? total / matches.length : 0)

  const sum = (pick: (m: SkillMatch) => number) => matches.reduce((t, m) => t + pick(m), 0)

  return {
    form: s.rating,
    aim: average(aims.map((a) => a.rating)),
    utility: utilityRating({
      damage: sum((m) => m.stats.utilityDamage),
      enemiesFlashed: s.enemiesFlashed,
      flashAssists: s.flashAssists,
      rounds: sum((m) => m.stats.roundsPlayed),
    }),
    impact: average(impacts),
    kd: s.kd,
    adr: s.adr,
    kast: s.kastPercent,
    openings: s.openingWinRate,
    accuracy: share(
      aimTotal((a) => a.hits),
      aimTotal((a) => a.shots),
    ),
    headHits: share(
      aimTotal((a) => a.headHits),
      aimTotal((a) => a.hits),
    ),
    counterStrafe: share(
      aimTotal((a) => a.counterStrafed),
      aimTotal((a) => a.bursts),
    ),
    headshots: s.hsPercent,
    utilityDamage: perMatch(sum((m) => m.stats.utilityDamage)),
    flashAssists: perMatch(s.flashAssists),
    enemiesFlashed: perMatch(s.enemiesFlashed),
    openingKills: perMatch(s.openingKills),
    clutches: perMatch(s.clutchesWon),
    tradeKills: perMatch(s.tradeKills),
    multiKillRounds: perMatch(s.multiKills.slice(1).reduce((a, b) => a + b, 0)),
  }
}

export type SkillMetric = keyof ReturnType<typeof measure>

const AREAS = {
  form: { scale: [0, 2], metrics: ['kd', 'adr', 'kast', 'openings'] },
  aim: { scale: [0, 100], metrics: ['accuracy', 'headHits', 'counterStrafe', 'headshots'] },
  utility: { scale: [0, 100], metrics: ['utilityDamage', 'enemiesFlashed', 'flashAssists'] },
  impact: {
    scale: [IMPACT_MIN, IMPACT_MAX],
    metrics: ['openingKills', 'clutches', 'tradeKills', 'multiKillRounds'],
  },
} satisfies Record<SkillArea, { scale: [number, number]; metrics: SkillMetric[] }>

const trendOf = (current: number | null, previous: number | null): SkillTrend | null => {
  if (current === null || previous === null) return null
  const moved = current - previous
  if (Math.abs(moved) <= Math.abs(previous) * FLAT_SHARE) return 'flat'

  return moved > 0 ? 'up' : 'down'
}

/**
 * The player's latest matches against the same number before them and against their lobbies, per
 * area. Short histories split in half, so both sides stay comparable.
 */
export const skillSummary = (newestFirst: SkillMatch[]) => {
  const count = newestFirst.length
  const size = count < 2 ? count : Math.min(SKILL_WINDOW, Math.floor(count / 2))
  const shown = newestFirst.slice(0, size)
  const earlier = newestFirst.slice(size, size * 2)
  const current = measure(shown)
  const previous = earlier.length ? measure(earlier) : null
  const lobby = summarizeLobby(shown.map((m) => m.lobby))
  const lobbyLevel = {
    form: lobby.rating,
    aim: lobby.aim,
    utility: lobby.utility,
    impact: lobby.impact,
  }

  return {
    size,
    areas: (Object.keys(AREAS) as SkillArea[]).map((area) => {
      const { scale, metrics } = AREAS[area]
      const value = current[area]
      const typical = lobbyLevel[area]
      const margin = (scale[1] - scale[0]) * LEVEL_SHARE

      const standing = (): SkillStanding | null => {
        if (value === null || typical === null) return null
        if (Math.abs(value - typical) <= margin) return 'level'

        return value > typical ? 'above' : 'below'
      }

      return {
        area,
        scale,
        value,
        previous: previous && previous[area],
        lobby: typical,
        standing: standing(),
        metrics: (metrics as SkillMetric[]).map((metric) => ({
          metric,
          value: current[metric],
          previous: previous && previous[metric],
          trend: trendOf(current[metric], previous && previous[metric]),
        })),
      }
    }),
  }
}
