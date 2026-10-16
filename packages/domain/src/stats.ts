export interface PlayerStats {
  kills: number
  deaths: number
  assists: number
  flashAssists: number
  headshotKills: number
  damage: number
  utilityDamage: number
  roundsPlayed: number
  /** Rounds with a kill, assist, survival or being traded. */
  kastRounds: number
  openingKills: number
  openingDeaths: number
  tradeKills: number
  enemiesFlashed: number
  /** Kill-count histogram: multiKills[n - 1] = rounds with exactly n kills (n = 1..TEAM_SIZE). */
  multiKills: [number, number, number, number, number]
  clutchesWon: number
  clutchesAttempted: number
  /** Derived values, rounded for display. */
  adr: number
  hsPercent: number
  kastPercent: number
  /** HLTV 1.0 rating formula. */
  rating: number
}
