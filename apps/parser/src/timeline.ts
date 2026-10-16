/**
 * Turns raw demo events into a match timeline: rounds with boundaries, sides and economy, and
 * every kill/damage/flash assigned to a round with both players' sides resolved.
 */
import { MAX_HEALTH, type Side, TICKRATE, secondsToTicks, sideFromTeamNum } from '@subtick/domain'
import type { DemoEvents, DemoHeader, DemoPlayer, PlayerSnapshot } from './demo'

export interface Round {
  number: number
  startTick: number
  freezeEndTick: number
  /** Buying is possible until here (20 s after freeze end in Premier). */
  buyTimeEndTick: number
  endTick: number
  /** Last tick that still belongs to this round (post-round time included). */
  lastTick: number
  winner: Side
  reason: string
  /** Side of every player who was on a team at freeze end. */
  sides: Map<string, Side>
  /** Equipment value after buying, per player. */
  equip: Map<string, number>
  /** Players alive at freeze end (normally all of them). */
  aliveAtStart: Set<string>
  /** Rounds won before this round, by the team that started the match on that side. */
  scoreBefore: Record<Side, number>
}

export interface Kill {
  id: number
  round: number
  tick: number
  attacker: string | null
  attackerName: string
  attackerSide: Side | null
  attackerHealth: number | null
  victim: string
  victimName: string
  victimSide: Side | null
  assister: string | null
  assistedFlash: boolean
  weapon: string
  headshot: boolean
  penetrated: boolean
  noscope: boolean
  throughSmoke: boolean
  attackerBlind: boolean
  attackerInAir: boolean
  distance: number
  /** World/bomb deaths and suicides have no credited attacker. */
  isSuicide: boolean
  isTeamKill: boolean
  /** Kill happened after `round_end` (exit frags, saves). */
  afterRoundEnd: boolean
}

export interface Damage {
  round: number
  tick: number
  attacker: string | null
  victim: string
  weapon: string
  /** Health actually removed (capped at the victim's remaining health). */
  amount: number
  isTeamDamage: boolean
}

export interface Blind {
  round: number
  tick: number
  attacker: string
  victim: string
  duration: number
  isTeamFlash: boolean
}

export interface BombEvent {
  round: number
  tick: number
  steamId: string | null
}

export interface PlayerInfo {
  steamId: string
  name: string
  startingSide: Side
}

export interface MatchTimeline {
  header: DemoHeader
  tickrate: number
  players: Map<string, PlayerInfo>
  rounds: Round[]
  kills: Kill[]
  damages: Damage[]
  blinds: Blind[]
  plants: BombEvent[]
  defuses: BombEvent[]
  /** Final score, keyed by the side each team started on. */
  finalScore: Record<Side, number>
  durationTicks: number
}

const POST_LAST_ROUND = secondsToTicks(5)

interface RoundBounds {
  startTick: number
  freezeEndTick: number
  buyTimeEndTick: number
  endTick: number
  lastTick: number
  winner: Side
  reason: string
}

/** Rounds are anchored on `round_end`; starts/freeze ends are matched to the closest preceding ones. */
export const buildRoundBounds = (events: DemoEvents): RoundBounds[] => {
  const matchStart = events.matchStarts.at(-1) ?? 0
  // round_start of round 1 can fire a tick *before* begin_new_match, so only filter ends.
  const ends = events.roundEnds.filter((e) => e.tick > matchStart)

  const bounds: RoundBounds[] = []
  let previousEnd = 0
  for (const end of ends) {
    const startTick =
      events.roundStarts.findLast((t) => t > previousEnd && t <= end.tick) ?? previousEnd
    const freezeEndTick =
      events.freezeEnds.findLast((t) => t >= startTick && t <= end.tick) ?? startTick
    const buyTimeEndTick =
      events.buyTimeEnds.find((t) => t > freezeEndTick && t <= end.tick) ?? freezeEndTick
    bounds.push({
      startTick,
      freezeEndTick,
      buyTimeEndTick,
      endTick: end.tick,
      lastTick: 0,
      winner: end.winner,
      reason: end.reason,
    })
    previousEnd = end.tick
  }

  for (const [i, round] of bounds.entries()) {
    const next = bounds[i + 1]
    round.lastTick = next ? next.startTick - 1 : round.endTick + POST_LAST_ROUND
  }
  return bounds
}

/** Index of the round containing `tick`, or -1 (warmup, between halves, after the demo ends). */
const roundIndexAt = (rounds: { startTick: number; lastTick: number }[], tick: number) => {
  let lo = 0
  let hi = rounds.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const round = rounds[mid]!
    if (tick < round.startTick) hi = mid - 1
    else if (tick > round.lastTick) lo = mid + 1
    else return mid
  }
  return -1
}

export const buildTimeline = (input: {
  header: DemoHeader
  players: DemoPlayer[]
  events: DemoEvents
  snapshots: PlayerSnapshot[]
}): MatchTimeline => {
  const { events } = input
  const bounds = buildRoundBounds(events)

  const snapshotsByTick = Map.groupBy(input.snapshots, (s) => s.tick)
  const names = new Map(input.players.map((p) => [p.steamId, p.name]))
  const players = new Map<string, PlayerInfo>()

  // Sides and starting sides come from freeze-end snapshots. Many players are still buying at
  // freeze end, and players who died before buy time ended report 0, so equipment is the max.
  const rounds: Round[] = bounds.map((b, i) => {
    const sides = new Map<string, Side>()
    const equip = new Map<string, number>()
    const aliveAtStart = new Set<string>()
    for (const s of snapshotsByTick.get(b.buyTimeEndTick) ?? []) equip.set(s.steamId, s.equipValue)
    for (const s of snapshotsByTick.get(b.freezeEndTick) ?? []) {
      const side = sideFromTeamNum(s.teamNum)!
      sides.set(s.steamId, side)
      equip.set(s.steamId, Math.max(s.equipValue, equip.get(s.steamId) ?? 0))
      if (s.isAlive) aliveAtStart.add(s.steamId)
      if (!players.has(s.steamId)) {
        players.set(s.steamId, {
          steamId: s.steamId,
          name: names.get(s.steamId) ?? s.steamId,
          startingSide: side,
        })
      }
    }
    return { number: i + 1, ...b, sides, equip, aliveAtStart, scoreBefore: { CT: 0, T: 0 } }
  })

  // Score per team identity ("the team that started CT"), robust to half-time and overtime swaps.
  const finalScore: Record<Side, number> = { CT: 0, T: 0 }
  for (const round of rounds) {
    round.scoreBefore = { ...finalScore }
    const winners = [...round.sides].filter(([, side]) => side === round.winner)
    const startedCt = winners.filter(([id]) => players.get(id)?.startingSide === 'CT').length
    const winnerIdentity: Side = startedCt * 2 >= winners.length ? 'CT' : 'T'
    finalScore[winnerIdentity]++
  }

  const sideAt = (roundIndex: number, steamId: string | null, teamNum: number | null) =>
    sideFromTeamNum(teamNum) ?? (steamId ? (rounds[roundIndex]?.sides.get(steamId) ?? null) : null)

  const kills: Kill[] = []
  for (const k of events.kills) {
    const r = roundIndexAt(rounds, k.tick)
    if (r === -1 || !k.victim.steamId) continue
    const round = rounds[r]!
    const victimSide = sideAt(r, k.victim.steamId, k.victim.teamNum)
    const attackerSide = sideAt(r, k.attacker.steamId, k.attacker.teamNum)
    const isSuicide = !k.attacker.steamId || k.attacker.steamId === k.victim.steamId
    kills.push({
      id: kills.length,
      round: round.number,
      tick: k.tick,
      attacker: isSuicide ? null : k.attacker.steamId,
      attackerName: k.attacker.name ?? '',
      attackerSide: isSuicide ? null : attackerSide,
      attackerHealth: k.attacker.health,
      victim: k.victim.steamId,
      victimName: k.victim.name ?? names.get(k.victim.steamId) ?? '',
      victimSide,
      assister: k.assister.steamId,
      assistedFlash: k.assistedFlash,
      weapon: k.weapon,
      headshot: k.headshot,
      penetrated: k.penetrated > 0,
      noscope: k.noscope,
      throughSmoke: k.throughSmoke,
      attackerBlind: k.attackerBlind,
      attackerInAir: k.attackerInAir,
      distance: k.distance,
      isSuicide,
      isTeamKill: !isSuicide && attackerSide !== null && attackerSide === victimSide,
      afterRoundEnd: k.tick > round.endTick,
    })
  }

  // Health is tracked per round so overkill damage (a 140-dmg AWP hit) is capped at what was left.
  const damages: Damage[] = []
  let health = new Map<string, number>()
  let currentRound = -1
  for (const d of events.damages) {
    const r = roundIndexAt(rounds, d.tick)
    if (r === -1 || !d.victim.steamId) continue
    if (r !== currentRound) {
      health = new Map()
      currentRound = r
    }
    const before = health.get(d.victim.steamId) ?? MAX_HEALTH
    health.set(d.victim.steamId, d.healthAfter)
    const attackerSide = sideAt(r, d.attacker.steamId, d.attacker.teamNum)
    damages.push({
      round: r + 1,
      tick: d.tick,
      attacker: d.attacker.steamId,
      victim: d.victim.steamId,
      weapon: d.weapon,
      amount: Math.max(0, Math.min(d.healthDamage, before)),
      isTeamDamage:
        attackerSide !== null && attackerSide === sideAt(r, d.victim.steamId, d.victim.teamNum),
    })
  }

  const blinds: Blind[] = []
  for (const b of events.blinds) {
    const r = roundIndexAt(rounds, b.tick)
    if (r === -1 || !b.attacker.steamId || !b.victim.steamId) continue
    blinds.push({
      round: r + 1,
      tick: b.tick,
      attacker: b.attacker.steamId,
      victim: b.victim.steamId,
      duration: b.duration,
      isTeamFlash:
        sideAt(r, b.attacker.steamId, b.attacker.teamNum) ===
        sideAt(r, b.victim.steamId, b.victim.teamNum),
    })
  }

  const assignRound = (e: { tick: number; steamId: string | null }) => {
    const r = roundIndexAt(rounds, e.tick)
    return r === -1 ? [] : [{ round: r + 1, ...e }]
  }

  return {
    header: input.header,
    tickrate: TICKRATE,
    players,
    rounds,
    kills,
    damages,
    blinds,
    plants: events.bombPlants.flatMap(assignRound),
    defuses: events.bombDefuses.flatMap(assignRound),
    finalScore,
    durationTicks: rounds.at(-1)?.lastTick ?? 0,
  }
}
