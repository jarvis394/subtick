import {
  type HighlightKind,
  type KillTag,
  type MomentTag,
  isOvertimeRound,
  TEAM_SIZE,
  isPistolRound,
  ticksToSeconds,
  weaponName,
  winsNeeded,
} from '@subtick/domain'
import type { HighlightConfig } from './config'
import type { Moment } from './moments'

export const momentTags = (moment: Moment, totalRounds: number): MomentTag[] => {
  const { round } = moment
  const tags: MomentTag[] = []
  const leader = Math.max(round.scoreBefore.CT, round.scoreBefore.T)
  if (moment.opening) tags.push('opening')
  if (isPistolRound(round.number)) tags.push('pistol_round')
  if (leader === winsNeeded(round.number - 1) - 1) tags.push('match_point')
  if (isOvertimeRound(round.number)) tags.push('overtime')
  if (round.number === totalRounds) tags.push('last_round')
  if (moment.defuse) tags.push('defuse')
  if (moment.ninjaDefuse) tags.push('ninja_defuse')
  return tags
}

const speedFactor = (moment: Moment, config: HighlightConfig) => {
  const { kills } = moment
  if (kills.length < 2) return 1
  const avgGap = ticksToSeconds(kills.at(-1)!.tick - kills[0]!.tick) / (kills.length - 1)
  return config.score.speed.find((s) => avgGap <= s.maxGapSeconds)?.factor ?? 1
}

export const scoreMoment = (
  moment: Moment,
  killTags: Map<number, KillTag[]>,
  tags: MomentTag[],
  config: HighlightConfig,
) => {
  const s = config.score
  let score = 0

  for (const k of moment.kills) {
    score += s.perKill
    for (const tag of killTags.get(k.id) ?? []) score += s.killTags[tag]
  }
  score +=
    (s.multiKill[Math.min(moment.kills.length, TEAM_SIZE)] ?? 0) * speedFactor(moment, config)
  if (moment.clutch?.won)
    score += s.clutchWon.base + s.clutchWon.perOpponent * moment.clutch.opponents
  if (moment.ninjaDefuse) score += s.ninjaDefuse
  else if (moment.defuse) score += s.defuse
  if (moment.opening) score += s.opening

  const i = s.importance
  const importance =
    1 +
    (tags.includes('pistol_round') ? i.pistolRound : 0) +
    (tags.includes('match_point') ? i.matchPoint : 0) +
    (tags.includes('overtime') ? i.overtime : 0) +
    (tags.includes('last_round') ? i.lastRound : 0)

  return Math.round(score * importance * 10) / 10
}

/** Tags that make even a single kill worth a title of its own (all have a TAG_LABELS entry). */
const SPECIAL_TAGS: KillTag[] = [
  'knife',
  'taser',
  'noscope',
  'grenade',
  'flick',
  'wallbang',
  'blind',
  'airborne',
  'smoke',
  'long_shot',
]

export const momentKind = (moment: Moment, killTags: Map<number, KillTag[]>): HighlightKind => {
  const n = moment.kills.length
  const tags = new Set(moment.kills.flatMap((k) => killTags.get(k.id) ?? []))
  if (n >= TEAM_SIZE) return 'ace'
  if (moment.clutch?.won) return 'clutch'
  if (n === 4) return 'quad'
  if (n === 3) return 'triple'
  if (tags.has('collateral')) return 'collateral'
  if (n === 2) return 'double'
  if (n === 0 || SPECIAL_TAGS.some((t) => tags.has(t))) return 'special'
  return 'single'
}

const TAG_LABELS: Partial<Record<KillTag, string>> = {
  knife: 'Knife kill',
  taser: 'Zeus kill',
  noscope: 'No-scope',
  grenade: 'Grenade kill',
  flick: 'Flick',
  wallbang: 'Wallbang',
  blind: 'Blind kill',
  airborne: 'Mid-air kill',
  smoke: 'Through smoke',
  long_shot: 'Long shot',
}

/** Most-used weapon in the moment, as a display name. */
const mainWeapon = (moment: Moment) => {
  const counts = Map.groupBy(moment.kills, (k) => k.weapon)
  const [weapon] = [...counts].toSorted((a, b) => b[1].length - a[1].length)[0] ?? ['']
  return weaponName(weapon)
}

export const momentTitle = (
  moment: Moment,
  kind: HighlightKind,
  killTags: Map<number, KillTag[]>,
) => {
  const n = moment.kills.length
  const weapon = mainWeapon(moment)
  const firstTag = moment.kills.flatMap((k) => killTags.get(k.id) ?? []).find((t) => TAG_LABELS[t])

  switch (kind) {
    case 'ace':
      return `Ace with the ${weapon}`
    case 'clutch': {
      const suffix = n ? ` · ${n}K` : moment.defuse ? ' · defuse' : ''
      return `1v${moment.clutch!.opponents} clutch${suffix}`
    }
    case 'quad':
    case 'triple':
    case 'double':
      return `${n}K with the ${weapon}`
    case 'collateral':
      return `Collateral with the ${weapon}`
    case 'special':
      if (!firstTag) return moment.ninjaDefuse ? 'Ninja defuse' : 'Bomb defuse'
      return `${TAG_LABELS[firstTag]} with the ${weapon}`
    case 'single':
      return `${killTags.get(moment.kills[0]!.id)?.includes('headshot') ? 'Headshot' : 'Kill'} with the ${weapon}`
  }
}
