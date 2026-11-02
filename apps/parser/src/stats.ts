import { type PlayerStats, TEAM_SIZE, secondsToTicks, weaponClass } from '@subtick/domain'
import type { Clutch } from './clutches'
import type { Kill, MatchTimeline } from './timeline'

/** A death is "traded" if the killer dies to the victim's team within this window. */
const TRADE_WINDOW = secondsToTicks(5)
/** Flashes shorter than this are not counted as "enemies flashed". */
const MIN_FLASH_SECONDS = 1

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** HLTV 1.0 rating; the constants are HLTV's published averages. */
const rating = (s: PlayerStats) => {
  if (s.roundsPlayed === 0) return 0
  const [k1, k2, k3, k4, k5] = s.multiKills
  const killRating = s.kills / s.roundsPlayed / 0.679
  const survivalRating = (s.roundsPlayed - s.deaths) / s.roundsPlayed / 0.317
  const multiKillRating = (k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5) / s.roundsPlayed / 1.277

  return (killRating + 0.7 * survivalRating + multiKillRating) / 2.7
}

const emptyStats = (): PlayerStats => ({
  kills: 0,
  deaths: 0,
  assists: 0,
  flashAssists: 0,
  headshotKills: 0,
  damage: 0,
  utilityDamage: 0,
  roundsPlayed: 0,
  kastRounds: 0,
  openingKills: 0,
  openingDeaths: 0,
  tradeKills: 0,
  enemiesFlashed: 0,
  multiKills: [0, 0, 0, 0, 0],
  clutchesWon: 0,
  clutchesAttempted: 0,
  adr: 0,
  hsPercent: 0,
  kastPercent: 0,
  rating: 0,
})

/** Credited enemy kill (no suicides, world deaths or team kills). */
export const isEnemyKill = (k: Kill): k is Kill & { attacker: string } =>
  k.attacker !== null && !k.isTeamKill

/** Kill `k` that avenges a teammate killed by `k.victim` shortly before. */
const isTrade = (k: Kill, roundKills: Kill[]) =>
  roundKills.some(
    (prior) =>
      prior.attacker === k.victim &&
      prior.victimSide === k.attackerSide &&
      prior.tick <= k.tick &&
      k.tick - prior.tick <= TRADE_WINDOW &&
      prior.id !== k.id,
  )

/** `death` was avenged by the victim's team shortly after. */
const isTraded = (death: Kill, roundKills: Kill[]) =>
  death.attacker !== null &&
  roundKills.some(
    (k) =>
      k.victim === death.attacker &&
      k.attackerSide === death.victimSide &&
      k.tick >= death.tick &&
      k.tick - death.tick <= TRADE_WINDOW,
  )

export const computeStats = (
  timeline: MatchTimeline,
  clutches: Clutch[],
): Map<string, PlayerStats> => {
  const stats = new Map([...timeline.players.keys()].map((id) => [id, emptyStats()]))

  const killsByRound = Map.groupBy(timeline.kills, (k) => k.round)

  const get = (id: string | null) => (id ? stats.get(id) : undefined)

  for (const round of timeline.rounds) {
    const roundKills = killsByRound.get(round.number) ?? []
    const enemyKills = roundKills.filter(isEnemyKill)
    const kast = new Set<string>()

    for (const id of round.sides.keys()) get(id)!.roundsPlayed++

    const opening = enemyKills.find((k) => !k.afterRoundEnd)
    if (opening) {
      get(opening.attacker)!.openingKills++
      if (get(opening.victim)) get(opening.victim)!.openingDeaths++
    }

    const killCount = new Map<string, number>()
    for (const k of roundKills) {
      const victim = get(k.victim)
      if (victim) victim.deaths++
      if (!isEnemyKill(k)) continue

      const attacker = get(k.attacker)
      if (!attacker) continue
      attacker.kills++
      if (k.headshot) attacker.headshotKills++
      if (isTrade(k, roundKills)) attacker.tradeKills++
      killCount.set(k.attacker, (killCount.get(k.attacker) ?? 0) + 1)
      kast.add(k.attacker)

      const assister = get(k.assister)
      if (assister && k.assister !== k.attacker) {
        if (k.assistedFlash) assister.flashAssists++
        else assister.assists++
        kast.add(k.assister!)
      }
    }

    for (const [id, count] of killCount) get(id)!.multiKills[Math.min(count, TEAM_SIZE) - 1]!++

    // Survived, or died and was traded.
    const deaths = new Map(roundKills.map((k) => [k.victim, k]))
    for (const id of round.sides.keys()) {
      const death = deaths.get(id)
      if (!death) kast.add(id)
      else if (isTraded(death, roundKills)) kast.add(id)
    }
    for (const id of kast) if (get(id)) get(id)!.kastRounds++
  }

  for (const d of timeline.damages) {
    const attacker = get(d.attacker)
    if (!attacker || d.isTeamDamage || d.attacker === d.victim) continue
    attacker.damage += d.amount
    if (weaponClass(d.weapon) === 'grenade') attacker.utilityDamage += d.amount
  }

  for (const b of timeline.blinds) {
    const attacker = get(b.attacker)
    if (attacker && !b.isTeamFlash && b.duration >= MIN_FLASH_SECONDS) attacker.enemiesFlashed++
  }

  for (const c of clutches) {
    const s = get(c.steamId)
    if (!s) continue
    s.clutchesAttempted++
    if (c.won) s.clutchesWon++
  }

  for (const s of stats.values()) {
    const rounds = Math.max(s.roundsPlayed, 1)
    s.adr = round1(s.damage / rounds)
    s.hsPercent = s.kills ? round1((s.headshotKills / s.kills) * 100) : 0
    s.kastPercent = round1((s.kastRounds / rounds) * 100)
    s.rating = round2(rating(s))
  }

  return stats
}
