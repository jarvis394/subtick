import { type Side, REGULATION_ROUNDS, ROUNDS_PER_HALF } from '@subtick/domain'
import type { MatchDetail } from '@/lib/queries'

export type Player = MatchDetail['players'][number]

export interface Column {
  id: string
  label: string
  title?: string
  value: (p: Player) => number
  format?: (n: number) => string
  /** Lower is better (deaths): colors and sorting flip. */
  inverse?: boolean
  muted?: boolean
}

const fixed = (digits: number) => (n: number) => n.toFixed(digits)
const per = (a: number, b: number) => (b ? a / b : a)

export const COLUMNS: Column[] = [
  { id: 'kills', label: 'K', title: 'Kills', value: (p) => p.stats.kills },
  {
    id: 'deaths',
    label: 'D',
    title: 'Deaths',
    value: (p) => p.stats.deaths,
    inverse: true,
    muted: true,
  },
  { id: 'assists', label: 'A', title: 'Assists', value: (p) => p.stats.assists, muted: true },
  {
    id: 'adr',
    label: 'ADR',
    title: 'Average damage per round',
    value: (p) => p.stats.adr,
    format: fixed(1),
  },
  { id: 'kd', label: 'K/D', value: (p) => per(p.stats.kills, p.stats.deaths), format: fixed(2) },
  {
    id: 'kr',
    label: 'K/R',
    title: 'Kills per round',
    value: (p) => per(p.stats.kills, p.stats.roundsPlayed),
    format: fixed(2),
  },
  {
    id: 'kast',
    label: 'KAST',
    title: 'Rounds with a kill, assist, survival or trade',
    value: (p) => p.stats.kastPercent,
    format: (n) => `${n.toFixed(1)}%`,
  },
  {
    id: 'hs',
    label: 'HS',
    title: 'Headshot kills',
    value: (p) => p.stats.headshotKills,
    muted: true,
  },
  {
    id: 'hsp',
    label: 'HS%',
    value: (p) => p.stats.hsPercent,
    format: (n) => `${n.toFixed(1)}%`,
    muted: true,
  },
  { id: 'fk', label: 'FK', title: 'Opening kills', value: (p) => p.stats.openingKills },
  { id: '5k', label: '5k', value: (p) => p.stats.multiKills[4] },
  { id: '4k', label: '4k', value: (p) => p.stats.multiKills[3] },
  { id: '3k', label: '3k', value: (p) => p.stats.multiKills[2] },
  { id: '2k', label: '2k', value: (p) => p.stats.multiKills[1] },
  { id: 'clutches', label: 'Clutch', title: 'Clutches won', value: (p) => p.stats.clutchesWon },
]

/** Columns holding decimals or percentages. */
export const WIDE_COLUMNS = new Set(['adr', 'kast', 'hsp', 'clutches'])

export const RATING: Column = {
  id: 'rating',
  label: 'Rating',
  title: 'HLTV 1.0 rating',
  value: (p) => p.stats.rating,
  format: fixed(2),
}

export const SORTABLE = [RATING, ...COLUMNS]

/** Team score per half: rounds 1–12, 13–24, then overtime. */
export const halfScores = (rounds: MatchDetail['rounds'], team: Side) => {
  const won = (from: number, to: number) =>
    rounds.filter((r) => r.number >= from && r.number <= to && r.winnerTeam === team).length

  const overtime = rounds.length > REGULATION_ROUNDS ? won(REGULATION_ROUNDS + 1, Infinity) : null

  return {
    first: won(1, ROUNDS_PER_HALF),
    second: won(ROUNDS_PER_HALF + 1, REGULATION_ROUNDS),
    overtime,
  }
}

/** Mean CS Rating of a team's placed Premier players. */
export const averagePremier = (team: Player[]) => {
  const ratings = team.flatMap((p) =>
    p.rank?.mode === 'premier' && p.rank.after > 0 ? [p.rank.after] : [],
  )

  return ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null
}

export const teamScore = (data: MatchDetail, side: Side) =>
  (side === 'CT' ? data.match.scoreStartedCt : data.match.scoreStartedT) ?? 0
