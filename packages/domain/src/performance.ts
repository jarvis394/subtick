import type { PlayerStats } from './stats'

/** Matches before this one that make up a player's usual level. */
export const BASELINE_MATCHES = 30
/** Below this the spread is noise, so no comparison is shown. */
export const MIN_BASELINE_MATCHES = 5

const METRICS = {
  impact: (s: PlayerStats) => s.impact ?? null,
  rating: (s: PlayerStats) => s.rating,
  adr: (s: PlayerStats) => s.adr,
  kast: (s: PlayerStats) => s.kastPercent,
  kd: (s: PlayerStats) => (s.deaths ? s.kills / s.deaths : s.kills),
}

export type PerformanceMetric = keyof typeof METRICS
export type PerformanceLevel = 'well-above' | 'above' | 'typical' | 'below' | 'well-below'

const round = (n: number) => Number(n.toFixed(2))

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const spread = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length

  return Math.sqrt(values.reduce((t, v) => t + (v - mean) ** 2, 0) / values.length)
}

const levelOf = (z: number): PerformanceLevel =>
  z >= 1.5
    ? 'well-above'
    : z >= 0.5
      ? 'above'
      : z > -0.5
        ? 'typical'
        : z > -1.5
          ? 'below'
          : 'well-below'

/** One match against the median of the player's earlier matches, metric by metric. */
export const comparePerformance = (match: PlayerStats, earlier: PlayerStats[]) =>
  (Object.keys(METRICS) as PerformanceMetric[]).flatMap((metric) => {
    const pick = METRICS[metric]
    const value = pick(match)
    const history = earlier.flatMap((s) => {
      const v = pick(s)

      return v === null ? [] : [v]
    })
    if (value === null || history.length < MIN_BASELINE_MATCHES) return []

    const baseline = median(history)
    const sigma = spread(history)
    const delta = value - baseline
    const z = sigma ? delta / sigma : 0

    return [
      {
        metric,
        value: round(value),
        baseline: round(baseline),
        delta: round(delta),
        /** Standard deviations from the median. */
        z: round(z),
        level: levelOf(z),
        matches: history.length,
      },
    ]
  })

export type PerformanceComparison = ReturnType<typeof comparePerformance>
