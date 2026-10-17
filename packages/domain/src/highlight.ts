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

/** A stretch of the demo that goes into a clip. A clip plays its segments back to back. */
export interface ClipSegment {
  startTick: number
  endTick: number
}

export interface Highlight {
  steamId: string
  playerName: string
  round: number
  kind: HighlightKind
  title: string
  score: number
  /** First segment's start and last segment's end. */
  startTick: number
  endTick: number
  /** In demo order, never overlapping. */
  segments: ClipSegment[]
  kills: HighlightKill[]
  tags: MomentTag[]
  clutch: HighlightClutch | null
}

/** A highlight's segments; ones stored before segments existed are a single window. */
export const clipSegments = (h: {
  startTick: number
  endTick: number
  segments?: ClipSegment[] | null
}): ClipSegment[] =>
  h.segments?.length ? h.segments : [{ startTick: h.startTick, endTick: h.endTick }]

/** How many ticks of footage the segments add up to. */
export const segmentsTicks = (segments: ClipSegment[]) =>
  segments.reduce((sum, s) => sum + s.endTick - s.startTick, 0)

/**
 * Where a demo tick lands in the clip, in ticks from its start. A tick between segments maps to
 * the cut (the start of the next one).
 */
export const clipOffsetTicks = (segments: ClipSegment[], tick: number) => {
  let offset = 0
  for (const s of segments) {
    if (tick < s.startTick) return offset
    if (tick <= s.endTick) return offset + tick - s.startTick
    offset += s.endTick - s.startTick
  }
  return offset
}
