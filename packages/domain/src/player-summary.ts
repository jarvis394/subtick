import type { PlayerStats } from './stats'
import { utilityRating } from './utility-rating'

export type MatchResult = 'win' | 'loss' | 'draw'

/** The other players in one match, summed, so any window of matches averages them exactly. */
export interface LobbyTotals {
  players: number
  ratingSum: number
  roundsPlayed: number
  utilityDamage: number
  enemiesFlashed: number
  flashAssists: number
  /** Only the players whose stats have them: older matches lack impact and aim. */
  impactSum: number
  impactPlayers: number
  aimSum: number
  aimPlayers: number
}

export interface SummaryMatch {
  stats: PlayerStats
  result: MatchResult | null
}

const round = (n: number, digits = 2) => Number(n.toFixed(digits))

const percent = (part: number, whole: number) => (whole ? round((part / whole) * 100, 0) : null)

/** Totals across matches, weighted by rounds where a per-match average would skew. */
export const summarize = (matches: SummaryMatch[]) => {
  const results = matches.map((m) => m.result)
  const wins = results.filter((r) => r === 'win').length
  const decided = results.filter((r) => r !== null).length

  const sum = (pick: (s: PlayerStats) => number) =>
    matches.reduce((total, m) => total + pick(m.stats), 0)

  const kills = sum((s) => s.kills)
  const deaths = sum((s) => s.deaths)
  const rounds = sum((s) => s.roundsPlayed)
  const headshots = sum((s) => s.headshotKills)
  const kast = sum((s) => s.kastRounds)
  const openingKills = sum((s) => s.openingKills)
  const openingDeaths = sum((s) => s.openingDeaths)

  return {
    matches: matches.length,
    wins,
    losses: results.filter((r) => r === 'loss').length,
    winRate: percent(wins, decided),
    rating: matches.length ? round(sum((s) => s.rating) / matches.length) : 0,
    kd: round(deaths ? kills / deaths : kills),
    adr: rounds ? round(sum((s) => s.damage) / rounds, 1) : 0,
    hsPercent: percent(headshots, kills) ?? 0,
    kastPercent: percent(kast, rounds) ?? 0,
    openingKills,
    openingWinRate: percent(openingKills, openingKills + openingDeaths),
    clutchesWon: sum((s) => s.clutchesWon),
    enemiesFlashed: sum((s) => s.enemiesFlashed),
    /** multiKills[n - 1] = rounds with exactly n kills. */
    multiKills: [0, 1, 2, 3, 4].map((n) => sum((s) => s.multiKills[n]!)),
    tradeKills: sum((s) => s.tradeKills),
    flashAssists: sum((s) => s.flashAssists),
    utilityPerRound: rounds ? round(sum((s) => s.utilityDamage) / rounds, 1) : 0,
  }
}

/** What the average other player in the same lobbies did, comparable to `summarize`. */
export const summarizeLobby = (lobbies: LobbyTotals[]) => {
  const sum = (pick: (l: LobbyTotals) => number) => lobbies.reduce((t, l) => t + pick(l), 0)

  const players = sum((l) => l.players)
  const rounds = sum((l) => l.roundsPlayed)
  const impactPlayers = sum((l) => l.impactPlayers)
  const aimPlayers = sum((l) => l.aimPlayers)

  return {
    rating: players ? round(sum((l) => l.ratingSum) / players) : null,
    utilityPerRound: rounds ? round(sum((l) => l.utilityDamage) / rounds, 1) : null,
    utility: utilityRating({
      damage: sum((l) => l.utilityDamage),
      enemiesFlashed: sum((l) => l.enemiesFlashed),
      flashAssists: sum((l) => l.flashAssists),
      rounds,
    }),
    impact: impactPlayers ? round(sum((l) => l.impactSum) / impactPlayers, 1) : null,
    aim: aimPlayers ? round(sum((l) => l.aimSum) / aimPlayers, 0) : null,
  }
}

export const lobbyTotals = (stats: PlayerStats[]): LobbyTotals => {
  const sum = (pick: (s: PlayerStats) => number) => stats.reduce((t, s) => t + pick(s), 0)

  return {
    players: stats.length,
    ratingSum: sum((s) => s.rating),
    roundsPlayed: sum((s) => s.roundsPlayed),
    utilityDamage: sum((s) => s.utilityDamage),
    enemiesFlashed: sum((s) => s.enemiesFlashed),
    flashAssists: sum((s) => s.flashAssists),
    impactSum: sum((s) => s.impact ?? 0),
    impactPlayers: stats.filter((s) => s.impact !== undefined).length,
    aimSum: sum((s) => s.aim?.rating ?? 0),
    aimPlayers: stats.filter((s) => s.aim).length,
  }
}
