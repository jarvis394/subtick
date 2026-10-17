/**
 * The recorder port: everything game-specific about turning a demo window into a video file.
 * The worker only plans clips and handles what comes out; adapters own the game.
 */
export interface Recorder {
  /** Loads a match's demo. Called once per batch, and again after a failed clip reset the game. */
  prepare(match: MatchToRecord): Promise<void>
  /** Renders one window of the prepared demo to a local video file. */
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
  startTick: number
  endTick: number
}

export interface RecordedFile {
  /** Video as written by the game capture, before post-processing. */
  path: string
  /** Game audio for the same window, when the adapter captures it. */
  audioPath?: string
  /** Wall time spent rendering, for capacity planning. */
  renderMs: number
}
