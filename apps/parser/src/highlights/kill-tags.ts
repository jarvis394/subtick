import { type KillTag, isPistolRound, weaponClass } from '@subtick/domain'
import type { Kill, MatchTimeline } from '../timeline'
import type { HighlightConfig } from './config'

/** Same attacker, same tick, same weapon: 2+ victims means one bullet went through. */
const collateralKey = (k: Kill) => `${k.attacker}:${k.tick}:${k.weapon}`

/** Tags for every credited kill, keyed by kill id. */
export const tagKills = (timeline: MatchTimeline, flicks: Set<number>, config: HighlightConfig) => {
  const { tags: t } = config
  const rounds = new Map(timeline.rounds.map((r) => [r.number, r]))

  const sameShot = Map.groupBy(timeline.kills, collateralKey)

  const result = new Map<number, KillTag[]>()
  for (const k of timeline.kills) {
    if (!k.attacker || k.isTeamKill) continue
    const cls = weaponClass(k.weapon)
    const round = rounds.get(k.round)!
    const tags: KillTag[] = []

    if (k.headshot) tags.push('headshot')
    if (k.penetrated) tags.push('wallbang')
    if (k.throughSmoke) tags.push('smoke')
    if (k.noscope) tags.push('noscope')
    if (k.attackerBlind) tags.push('blind')
    if (k.attackerInAir) tags.push('airborne')
    if (flicks.has(k.id)) tags.push('flick')
    if (k.distance >= (cls === 'sniper' ? t.sniperLongShotMeters : t.longShotMeters))
      tags.push('long_shot')
    if (cls === 'knife') tags.push('knife')
    if (cls === 'taser') tags.push('taser')
    if (cls === 'grenade') tags.push('grenade')
    if (sameShot.get(collateralKey(k))!.length > 1) tags.push('collateral')
    if (k.attackerHealth !== null && k.attackerHealth > 0 && k.attackerHealth <= t.lowHp)
      tags.push('low_hp')

    const attackerEquip = round.equip.get(k.attacker) ?? Infinity
    const victimEquip = round.equip.get(k.victim) ?? 0
    if (
      !isPistolRound(k.round) &&
      attackerEquip <= t.eco.attackerMax &&
      victimEquip >= t.eco.victimMin
    ) {
      tags.push('eco')
    }

    result.set(k.id, tags)
  }

  return result
}
