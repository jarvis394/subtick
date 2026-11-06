/** Gun shots only (pistols, SMGs, rifles, snipers); shotguns and LMGs skew accuracy. */
export interface AimStats {
  shots: number
  /** Bullet hits on enemies. */
  hits: number
  headHits: number
  /** First shots after a pause, the ones a player has time to stop for. */
  bursts: number
  /** Bursts started slower than COUNTER_STRAFE_SPEED. */
  counterStrafed: number
  /** 0–100 from accuracy, head-hit rate, headshot kills and counter-strafing. */
  rating: number
}

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
  /**
   * Mean share of round win probability the player swung, × 100, in IMPACT_MIN..IMPACT_MAX.
   * Missing on matches analyzed before parser v8.
   */
  impact?: number
  /** Missing on matches analyzed before parser v9. */
  aim?: AimStats
}

export const IMPACT_MAX = 30
export const IMPACT_MIN = -15
