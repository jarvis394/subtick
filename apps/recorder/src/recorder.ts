import type { ClipSegment } from '@subtick/domain'

/**
 * The recorder port: everything game-specific about turning a demo window into a video file.
 * The worker only plans clips and handles what comes out; adapters own the game.
 */
export interface Recorder {
  /** Loads a match's demo. Called once per batch, and again after a failed clip reset the game. */
  prepare(match: MatchToRecord): Promise<void>
  /** Renders a clip's segments of the prepared demo to local video files, one per segment. */
  record(clip: ClipPlan): Promise<RecordedFile>
  /** Forgets the loaded demo (and, for game adapters, restarts the game on next use). */
  reset(): Promise<void>
  /** The match whose demo is loaded, so `record` can be called; `null` when none is. */
  readonly loadedMatchId: string | null
}

export interface MatchToRecord {
  matchId: string
  /** Uncompressed `.dem` on local disk. */
  demoPath: string
  map: string
}

export interface ClipPlan {
  highlightId: string
  /** Name to spectate, as it appears in the demo. */
  playerName: string
  /** In demo order, never overlapping. */
  segments: ClipSegment[]
}

export interface RecordedPart {
  /** Video as written by the game capture, before post-processing. */
  path: string
  /** Game audio for the same window, when the adapter captures it. */
  audioPath?: string
}

export interface RecordedFile {
  /** One per segment, in order. */
  parts: RecordedPart[]
  /** Holds every part; removed once the clip is delivered. */
  dir: string
  /** Wall time spent rendering, for capacity planning. */
  renderMs: number
}
