import type { PlayerStats } from './stats'

export type MatchResult = 'win' | 'loss' | 'draw'

/** The other players in one match, summed, so any window of matches averages them exactly. */
export interface LobbyTotals {
  players: number
  ratingSum: number
  kills: number
  deaths: number
  damage: number
  roundsPlayed: number
  headshotKills: number
  kastRounds: number
  openingKills: number
  openingDeaths: number
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
    openingDeaths,
    openingWinRate: percent(openingKills, openingKills + openingDeaths),
    clutchesWon: sum((s) => s.clutchesWon),
    clutchesAttempted: sum((s) => s.clutchesAttempted),
    roundsPlayed: rounds,
    /** multiKills[n - 1] = rounds with exactly n kills. */
    multiKills: [0, 1, 2, 3, 4].map((n) => sum((s) => s.multiKills[n]!)),
    tradeKills: sum((s) => s.tradeKills),
    flashAssists: sum((s) => s.flashAssists),
    utilityPerRound: rounds ? round(sum((s) => s.utilityDamage) / rounds, 1) : 0,
  }
}

export type PlayerSummary = ReturnType<typeof summarize>

/** What the average other player in the same lobbies did, comparable to `summarize`. */
export const summarizeLobby = (lobbies: LobbyTotals[]) => {
  const sum = (pick: (l: LobbyTotals) => number) => lobbies.reduce((t, l) => t + pick(l), 0)

  const players = sum((l) => l.players)
  const kills = sum((l) => l.kills)
  const deaths = sum((l) => l.deaths)
  const rounds = sum((l) => l.roundsPlayed)
  const headshots = sum((l) => l.headshotKills)
  const kast = sum((l) => l.kastRounds)
  const openingKills = sum((l) => l.openingKills)

  return {
    rating: players ? round(sum((l) => l.ratingSum) / players) : 0,
    kd: round(deaths ? kills / deaths : kills),
    adr: rounds ? round(sum((l) => l.damage) / rounds, 1) : 0,
    hsPercent: percent(headshots, kills) ?? 0,
    kastPercent: percent(kast, rounds) ?? 0,
    openingWinRate: percent(openingKills, openingKills + sum((l) => l.openingDeaths)),
  }
}

export const lobbyTotals = (stats: PlayerStats[]): LobbyTotals => {
  const sum = (pick: (s: PlayerStats) => number) => stats.reduce((t, s) => t + pick(s), 0)

  return {
    players: stats.length,
    ratingSum: sum((s) => s.rating),
    kills: sum((s) => s.kills),
    deaths: sum((s) => s.deaths),
    damage: sum((s) => s.damage),
    roundsPlayed: sum((s) => s.roundsPlayed),
    headshotKills: sum((s) => s.headshotKills),
    kastRounds: sum((s) => s.kastRounds),
    openingKills: sum((s) => s.openingKills),
    openingDeaths: sum((s) => s.openingDeaths),
  }
}
