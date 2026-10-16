/** What a highlight is *about*. Picked by priority when several apply. */
export const HIGHLIGHT_KINDS = [
  'ace',
  'clutch',
  'quad',
  'triple',
  'collateral',
  'double',
  'special',
  'single',
] as const
export type HighlightKind = (typeof HIGHLIGHT_KINDS)[number]

export const HIGHLIGHT_STATUSES = ['candidate', 'queued', 'recorded', 'skipped', 'failed'] as const
export type HighlightStatus = (typeof HIGHLIGHT_STATUSES)[number]

/** Per-kill properties that make a moment more interesting. */
export const KILL_TAGS = [
  'headshot',
  'wallbang',
  'smoke',
  'noscope',
  'blind',
  'airborne',
  'flick',
  'long_shot',
  'knife',
  'taser',
  'grenade',
  'collateral',
  'low_hp',
  'eco',
] as const
export type KillTag = (typeof KILL_TAGS)[number]

/** Per-highlight context that is not tied to a single kill. */
export const MOMENT_TAGS = [
  'opening',
  'pistol_round',
  'match_point',
  'overtime',
  'last_round',
  'defuse',
  'ninja_defuse',
] as const
export type MomentTag = (typeof MOMENT_TAGS)[number]

export interface HighlightKill {
  tick: number
  victimSteamId: string
  victimName: string
  weapon: string
  tags: KillTag[]
}

export interface HighlightClutch {
  /** Enemies alive when the player became the last one alive. */
  opponents: number
  won: boolean
  startTick: number
}

export interface Highlight {
  steamId: string
  playerName: string
  round: number
  kind: HighlightKind
  title: string
  score: number
  startTick: number
  endTick: number
  kills: HighlightKill[]
  tags: MomentTag[]
  clutch: HighlightClutch | null
}
