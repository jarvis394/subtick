import { weaponClass } from '@subtick/domain'
import type { ViewAngleSample } from '../demo'
import type { Kill } from '../timeline'
import type { HighlightConfig } from './config'

const FLICKABLE = new Set(['pistol', 'smg', 'heavy', 'rifle', 'sniper'])

const isFlickable = (k: Kill): k is Kill & { attacker: string } =>
  k.attacker !== null && FLICKABLE.has(weaponClass(k.weapon))

/** Ticks/players to sample view angles for: the few ticks before every gun kill. */
export const flickSampleRequest = (kills: Kill[], config: HighlightConfig) => {
  const ticks = new Set<number>()
  const steamIds = new Set<string>()
  for (const k of kills.filter(isFlickable)) {
    steamIds.add(k.attacker)
    for (let t = k.tick - config.tags.flickTicks; t <= k.tick; t++) ticks.add(t)
  }
  return { ticks: [...ticks].toSorted((a, b) => a - b), steamIds: [...steamIds] }
}

const angleBetween = (a: ViewAngleSample, b: ViewAngleSample) => {
  const yaw = Math.abs(((b.yaw - a.yaw + 540) % 360) - 180)
  const pitch = b.pitch - a.pitch
  return Math.hypot(yaw, pitch)
}

/**
 * A flick is a large, fast rotation right before the kill: the furthest the crosshair was from
 * its kill-tick position during the last `flickTicks` ticks.
 */
export const detectFlicks = (
  kills: Kill[],
  samples: ViewAngleSample[],
  config: HighlightConfig,
) => {
  const byPlayerTick = new Map(samples.map((s) => [`${s.steamId}:${s.tick}`, s]))
  const flicks = new Set<number>()

  for (const k of kills.filter(isFlickable)) {
    const atKill = byPlayerTick.get(`${k.attacker}:${k.tick}`)
    if (!atKill) continue
    let maxAngle = 0
    for (let t = k.tick - config.tags.flickTicks; t < k.tick; t++) {
      const sample = byPlayerTick.get(`${k.attacker}:${t}`)
      if (sample) maxAngle = Math.max(maxAngle, angleBetween(sample, atKill))
    }
    if (maxAngle >= config.tags.flickDegrees) flicks.add(k.id)
  }

  return flicks
}
