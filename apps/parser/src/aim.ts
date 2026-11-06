import { type AimStats, type WeaponClass, secondsToTicks, weaponClass } from '@subtick/domain'
import type { PositionSample } from './demo'
import { isEnemyKill } from './stats'
import type { MatchTimeline, Shot } from './timeline'

const AIM_CLASSES = new Set<WeaponClass>(['pistol', 'smg', 'rifle', 'sniper'])
/** A shot this long after the player's previous one starts a new burst. */
const BURST_GAP = secondsToTicks(0.5)
/** Units per second; about a third of rifle run speed, where guns are accurate again. */
export const COUNTER_STRAFE_SPEED = 80
/** Speed is measured over this many ticks before the shot. */
const SPEED_TICKS = 2

/** Value at which a part scores 0 and 100; hand-set until there are enough matches to rank. */
const PARTS = {
  accuracy: { from: 0.12, to: 0.3, weight: 0.25 },
  headHits: { from: 0.1, to: 0.35, weight: 0.35 },
  headshotKills: { from: 0.25, to: 0.65, weight: 0.15 },
  counterStrafe: { from: 0.5, to: 0.9, weight: 0.25 },
}

const isAimWeapon = (weapon: string) => AIM_CLASSES.has(weaponClass(weapon))

/** Each player's first shot after a pause. */
export const burstStarts = (shots: Shot[]) => {
  const last = new Map<string, number>()

  return shots
    .filter((s) => isAimWeapon(s.weapon))
    .filter((s) => {
      const previous = last.get(s.steamId)
      last.set(s.steamId, s.tick)

      return previous === undefined || s.tick - previous > BURST_GAP
    })
}

export const positionSampleRequest = (shots: Shot[]) => {
  const bursts = burstStarts(shots)

  return {
    ticks: [...new Set(bursts.flatMap((s) => [s.tick - SPEED_TICKS, s.tick]))].toSorted(
      (a, b) => a - b,
    ),
    steamIds: [...new Set(bursts.map((s) => s.steamId))],
  }
}

/** Weighted mean of the parts a player has samples for, 0–100. */
export const aimRating = (parts: Record<keyof typeof PARTS, { part: number; whole: number }>) => {
  let total = 0
  let weights = 0
  for (const [key, { part, whole }] of Object.entries(parts)) {
    if (!whole) continue
    const { from, to, weight } = PARTS[key as keyof typeof PARTS]
    total += weight * Math.min(1, Math.max(0, (part / whole - from) / (to - from)))
    weights += weight
  }

  return weights ? Math.round((total / weights) * 100) : 0
}

export const computeAim = (timeline: MatchTimeline, positions: PositionSample[]) => {
  const at = new Map(positions.map((p) => [`${p.steamId}:${p.tick}`, p]))
  const counts = new Map<string, Omit<AimStats, 'rating'> & { kills: number; headshots: number }>()

  const get = (id: string) => {
    let c = counts.get(id)
    if (!c) {
      c = { shots: 0, hits: 0, headHits: 0, bursts: 0, counterStrafed: 0, kills: 0, headshots: 0 }
      counts.set(id, c)
    }

    return c
  }

  for (const s of timeline.shots) if (isAimWeapon(s.weapon)) get(s.steamId).shots++
  for (const s of burstStarts(timeline.shots)) {
    const from = at.get(`${s.steamId}:${s.tick - SPEED_TICKS}`)
    const to = at.get(`${s.steamId}:${s.tick}`)
    if (!from || !to) continue
    const speed = (Math.hypot(to.x - from.x, to.y - from.y) * timeline.tickrate) / SPEED_TICKS
    const c = get(s.steamId)
    c.bursts++
    if (speed <= COUNTER_STRAFE_SPEED) c.counterStrafed++
  }
  for (const d of timeline.damages) {
    if (!d.attacker || d.isTeamDamage || !isAimWeapon(d.weapon)) continue
    const c = get(d.attacker)
    c.hits++
    if (d.hitgroup === 'head') c.headHits++
  }
  for (const k of timeline.kills) {
    if (!isEnemyKill(k) || !isAimWeapon(k.weapon)) continue
    const c = get(k.attacker)
    c.kills++
    if (k.headshot) c.headshots++
  }

  return new Map(
    [...counts].map(([id, { kills, headshots, ...c }]): [string, AimStats] => [
      id,
      {
        ...c,
        rating: aimRating({
          accuracy: { part: c.hits, whole: c.shots },
          headHits: { part: c.headHits, whole: c.hits },
          headshotKills: { part: headshots, whole: kills },
          counterStrafe: { part: c.counterStrafed, whole: c.bursts },
        }),
      },
    ]),
  )
}
