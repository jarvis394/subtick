import { SIDES, type Side, otherSide } from '@subtick/domain'
import type { Kill, MatchTimeline, Round } from './timeline'

export interface Clutch {
  round: number
  steamId: string
  side: Side
  /** Enemies alive at the moment the player became the last one alive. */
  opponents: number
  startTick: number
  won: boolean
  /** Kills by the clutcher after the clutch started. */
  kills: number
}

/** Players alive on each side right after `tick` (deaths at `tick` included). */
export const aliveAt = (
  round: Round,
  roundKills: Kill[],
  tick: number,
): Record<Side, Set<string>> => {
  const alive: Record<Side, Set<string>> = { CT: new Set(), T: new Set() }
  for (const id of round.aliveAtStart) {
    const side = round.sides.get(id)
    if (side) alive[side].add(id)
  }
  for (const kill of roundKills) {
    if (kill.tick > tick) break
    alive.CT.delete(kill.victim)
    alive.T.delete(kill.victim)
  }
  return alive
}

/**
 * A clutch starts when a side is down to one player while the other side still has someone
 * alive. Simultaneous trades can create a clutch for both sides (1v1); the round winner wins it.
 */
export const detectClutches = (timeline: MatchTimeline): Clutch[] => {
  const killsByRound = Map.groupBy(timeline.kills, (k) => k.round)
  const clutches: Clutch[] = []

  for (const round of timeline.rounds) {
    const roundKills = (killsByRound.get(round.number) ?? []).filter((k) => !k.afterRoundEnd)
    const found = new Map<Side, Clutch>()

    // Deaths sharing a tick are applied together before checking.
    for (const tick of new Set(roundKills.map((k) => k.tick))) {
      const alive = aliveAt(round, roundKills, tick)
      for (const side of SIDES) {
        const enemies = alive[otherSide(side)].size
        if (found.has(side) || alive[side].size !== 1 || enemies === 0) continue
        const [steamId] = alive[side]
        found.set(side, {
          round: round.number,
          steamId: steamId!,
          side,
          opponents: enemies,
          startTick: tick,
          won: round.winner === side,
          kills: 0,
        })
      }
    }

    for (const clutch of found.values()) {
      clutch.kills = roundKills.filter(
        (k) => k.attacker === clutch.steamId && k.tick >= clutch.startTick && !k.isTeamKill,
      ).length
      clutches.push(clutch)
    }
  }

  return clutches
}
