/**
 * Impact rating: each kill, plant and defuse moves a team's chance to win the round, and the
 * players who caused the move share it. A match score is the mean per-round share × 100.
 */
import { IMPACT_MAX, IMPACT_MIN, MAX_HEALTH, type Side } from '@subtick/domain'
import { isTraded } from './stats'
import type { Kill, MatchTimeline, Round } from './timeline'

/** Hand-set logistic weights until there are enough rounds to fit them. */
const WEIGHTS = { alive: 0.9, equip: 2.5, plant: 1.2 }
/** Win chance of the side that is still alive when the other is wiped but the bomb is down. */
const POST_PLANT_WIPE = 0.9
/** Most of a kill's swing a damage dealer or flasher can take from the killer. */
const DAMAGE_SHARE = 0.3
const FLASH_SHARE = 0.15

interface WinState {
  alive: Record<Side, Set<string>>
  planted: boolean
}

const other = (side: Side): Side => (side === 'CT' ? 'T' : 'CT')

/** Chance that `side` wins the round from here. */
export const winProbability = (state: WinState, equip: Map<string, number>, side: Side) => {
  const own = state.alive[side]
  const opp = state.alive[other(side)]
  const bomb = state.planted ? (side === 'T' ? 1 : -1) : 0

  const teamEquip = (ids: Set<string>) => [...ids].reduce((t, id) => t + (equip.get(id) ?? 0), 0)

  if (opp.size === 0) return state.planted && side === 'CT' ? POST_PLANT_WIPE : 1
  if (own.size === 0) return state.planted && side === 'T' ? 1 - POST_PLANT_WIPE : 0

  const ownEquip = teamEquip(own)
  const oppEquip = teamEquip(opp)
  const equipEdge = ownEquip + oppEquip ? (ownEquip - oppEquip) / (ownEquip + oppEquip) : 0
  const logit =
    WEIGHTS.alive * (own.size - opp.size) + WEIGHTS.equip * equipEdge + WEIGHTS.plant * bomb

  return 1 / (1 + Math.exp(-logit))
}

/** Soft clamp into IMPACT_MIN..IMPACT_MAX that keeps players in order. */
export const scaleImpact = (raw: number) =>
  raw >= 0 ? IMPACT_MAX * Math.tanh(raw / IMPACT_MAX) : -IMPACT_MIN * Math.tanh(raw / -IMPACT_MIN)

type RoundEvent =
  | { tick: number; kind: 'kill'; kill: Kill }
  | { tick: number; kind: 'plant'; steamId: string | null }
  | { tick: number; kind: 'defuse'; steamId: string | null }

/** Win-probability shares per player for one round. */
const roundShares = (round: Round, events: RoundEvent[], timeline: MatchTimeline) => {
  const shares = new Map<string, number>()
  const alive: WinState['alive'] = { CT: new Set(), T: new Set() }
  for (const id of round.aliveAtStart) {
    const side = round.sides.get(id)
    if (side) alive[side].add(id)
  }
  const state: WinState = { alive, planted: false }
  const roundKills = events.flatMap((e) => (e.kind === 'kill' ? [e.kill] : []))
  const damages = timeline.damages.filter((d) => d.round === round.number && !d.isTeamDamage)

  const credit = (id: string | null, amount: number) => {
    if (id && round.sides.has(id)) shares.set(id, (shares.get(id) ?? 0) + amount)
  }

  const wp = (side: Side) => winProbability(state, round.equip, side)

  const creditKill = (k: Kill, swing: number) => {
    const helpers = new Map<string, number>()
    for (const d of damages) {
      if (
        d.victim !== k.victim ||
        d.tick > k.tick ||
        !d.attacker ||
        d.attacker === k.attacker ||
        d.amount <= 0
      ) {
        continue
      }
      if (round.sides.get(d.attacker) !== k.attackerSide) continue
      helpers.set(d.attacker, (helpers.get(d.attacker) ?? 0) + d.amount)
    }
    const helperDamage = [...helpers.values()].reduce((a, b) => a + b, 0)
    const damageShare = DAMAGE_SHARE * Math.min(1, helperDamage / MAX_HEALTH)
    const flashShare = k.assistedFlash && k.assister ? FLASH_SHARE : 0

    for (const [id, dmg] of helpers) credit(id, (swing * damageShare * dmg) / helperDamage)
    credit(k.assistedFlash ? k.assister : null, swing * flashShare)
    credit(k.attacker, swing * (1 - damageShare - flashShare))
  }

  for (const e of events) {
    if (e.kind === 'plant') {
      const before = wp('T')
      state.planted = true
      credit(e.steamId, wp('T') - before)
      continue
    }
    if (e.kind === 'defuse') {
      credit(e.steamId, 1 - wp('CT'))
      continue
    }

    const k = e.kill
    const victimSide = round.sides.get(k.victim)
    if (!victimSide || !alive[victimSide].has(k.victim)) continue
    const before = wp(victimSide)
    alive[victimSide].delete(k.victim)
    const loss = before - wp(victimSide)

    if (k.attacker === null || k.isSuicide) credit(k.victim, -loss)
    else if (k.isTeamKill) credit(k.attacker, -loss)
    else {
      creditKill(k, loss)
      credit(k.victim, isTraded(k, roundKills) ? -loss / 2 : -loss)
    }
  }

  return shares
}

const byRound = <T extends { round: number }>(items: T[]) => Map.groupBy(items, (x) => x.round)

/** Impact rating per player, already scaled into IMPACT_MIN..IMPACT_MAX. */
export const computeImpact = (timeline: MatchTimeline) => {
  const totals = new Map<string, { sum: number; rounds: number }>()

  const kills = byRound(timeline.kills.filter((k) => !k.afterRoundEnd))
  const plants = byRound(timeline.plants)
  const defuses = byRound(timeline.defuses)

  for (const round of timeline.rounds) {
    const events: RoundEvent[] = [
      ...(kills.get(round.number) ?? []).map((kill) => ({
        tick: kill.tick,
        kind: 'kill' as const,
        kill,
      })),
      ...(plants.get(round.number) ?? []).map((p) => ({ ...p, kind: 'plant' as const })),
      ...(defuses.get(round.number) ?? []).map((d) => ({ ...d, kind: 'defuse' as const })),
    ].toSorted((a, b) => a.tick - b.tick)
    const shares = roundShares(round, events, timeline)

    for (const id of round.sides.keys()) {
      const t = totals.get(id) ?? { sum: 0, rounds: 0 }
      t.sum += shares.get(id) ?? 0
      t.rounds++
      totals.set(id, t)
    }
  }

  return new Map(
    [...totals].map(([id, t]) => [id, Math.round(scaleImpact((100 * t.sum) / t.rounds) * 10) / 10]),
  )
}
