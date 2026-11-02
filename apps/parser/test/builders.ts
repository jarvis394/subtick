/** Hand-built timelines for unit tests: no demo needed. */
import { MAX_HEALTH, type Side } from '@subtick/domain'
import type { Kill, MatchTimeline, PlayerInfo, Round } from '../src/timeline'

export const CT = ['ct1', 'ct2', 'ct3', 'ct4', 'ct5'] as const
export const T = ['t1', 't2', 't3', 't4', 't5'] as const

const sideOf = (id: string): Side => (id.startsWith('ct') ? 'CT' : 'T')

/** 64 ticks per second; each round is 2 minutes long, starting at `(n - 1) * 10_000`. */
const ROUND_LENGTH = 10_000

export const roundTick = (round: number, seconds: number) =>
  (round - 1) * ROUND_LENGTH + 1000 + seconds * 64

export interface KillSpec extends Partial<Omit<Kill, 'id' | 'round' | 'tick'>> {
  /** Seconds after freeze end. */
  at: number
  attacker: string | null
  victim: string
}

export interface RoundSpec {
  winner: Side
  kills?: KillSpec[]
  /** Seconds after freeze end at which the round ends (default: last kill or 100 s). */
  endsAt?: number
  equip?: Partial<Record<string, number>>
  defuse?: { at: number; steamId: string }
}

export const buildTestTimeline = (specs: RoundSpec[]): MatchTimeline => {
  const players = new Map<string, PlayerInfo>(
    [...CT, ...T].map((id) => [
      id,
      { steamId: id, name: id.toUpperCase(), startingSide: sideOf(id) },
    ]),
  )

  const kills: Kill[] = []
  const rounds: Round[] = specs.map((spec, i) => {
    const number = i + 1
    for (const k of spec.kills ?? []) {
      const attackerSide = k.attacker ? sideOf(k.attacker) : null
      kills.push({
        attackerName: k.attacker?.toUpperCase() ?? '',
        attackerHealth: MAX_HEALTH,
        victimName: k.victim.toUpperCase(),
        victimSide: sideOf(k.victim),
        assister: null,
        assistedFlash: false,
        weapon: 'ak47',
        headshot: false,
        penetrated: false,
        noscope: false,
        throughSmoke: false,
        attackerBlind: false,
        attackerInAir: false,
        distance: 10,
        isSuicide: k.attacker === null,
        isTeamKill: attackerSide !== null && attackerSide === sideOf(k.victim),
        afterRoundEnd: false,
        ...k,
        id: kills.length,
        round: number,
        tick: roundTick(number, k.at),
        attackerSide,
      })
    }
    const lastKill = spec.kills?.at(-1)?.at
    const endTick = roundTick(number, spec.endsAt ?? lastKill ?? 100)
    const all = [...CT, ...T]

    return {
      number,
      startTick: (number - 1) * ROUND_LENGTH,
      freezeEndTick: roundTick(number, 0),
      buyTimeEndTick: roundTick(number, 20),
      endTick,
      lastTick: number * ROUND_LENGTH - 1,
      winner: spec.winner,
      reason: spec.winner === 'CT' ? 't_killed' : 'ct_killed',
      sides: new Map(all.map((id) => [id, sideOf(id)])),
      equip: new Map(all.map((id) => [id, spec.equip?.[id] ?? 4500])),
      aliveAtStart: new Set(all),
      scoreBefore: { CT: 0, T: 0 },
      // Test teams never swap sides.
      winnerTeam: spec.winner,
    }
  })

  return {
    header: { map: 'de_test', serverName: 'test' },
    tickrate: 64,
    players,
    rounds,
    kills,
    damages: [],
    blinds: [],
    plants: [],
    defuses: specs.flatMap((s, i) =>
      s.defuse
        ? [{ round: i + 1, tick: roundTick(i + 1, s.defuse.at), steamId: s.defuse.steamId }]
        : [],
    ),
    explosions: [],
    finalScore: { CT: 0, T: 0 },
    durationTicks: specs.length * ROUND_LENGTH,
  }
}
