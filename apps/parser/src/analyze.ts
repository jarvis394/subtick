import {
  type Highlight,
  type KillTag,
  type MatchMode,
  type PlayerRank,
  type PlayerStats,
  modeFromRankType,
} from '@subtick/domain'
import { type Clutch, detectClutches } from './clutches'
import { type PlayerSnapshot, openDemo } from './demo'
import {
  type HighlightConfig,
  detectHighlights,
  flickSampleRequest,
  highlightConfig,
} from './highlights'
import { computeStats } from './stats'
import { type MatchTimeline, buildTimeline } from './timeline'

/** Bump when analysis output changes, so stored matches can be re-analyzed. */
export const PARSER_VERSION = 7

export interface MatchAnalysis {
  timeline: MatchTimeline
  clutches: Clutch[]
  stats: Map<string, PlayerStats>
  highlights: Highlight[]
  /** Tags of every credited kill, by kill id. */
  killTags: Map<number, KillTag[]>
  /** Matchmaking mode; `null` for demos without rank updates (e.g. private servers). */
  mode: MatchMode | null
  ranks: Map<string, PlayerRank>
  /** Each player's crosshair code at the last snapshot that had one. */
  crosshairs: Map<string, string>
}

export const latestCrosshairs = (snapshots: PlayerSnapshot[]) => {
  const codes = new Map<string, string>()
  for (const s of snapshots.toSorted((a, b) => a.tick - b.tick)) {
    if (s.crosshairCode) codes.set(s.steamId, s.crosshairCode)
  }

  return codes
}

/** Full analysis of one demo. Synchronous and CPU-bound (≈1–2 s for a full match). */
export const analyzeDemo = (
  data: Buffer,
  config: HighlightConfig = highlightConfig,
): MatchAnalysis => {
  const demo = openDemo(data)
  const snapshotTicks = [...new Set([...demo.events.freezeEnds, ...demo.events.buyTimeEnds])]

  const snapshots = demo.snapshots(snapshotTicks)
  const timeline = buildTimeline({
    header: demo.header,
    players: demo.players,
    events: demo.events,
    snapshots,
  })
  const clutches = detectClutches(timeline)
  const stats = computeStats(timeline, clutches)

  const { ticks, steamIds } = flickSampleRequest(timeline.kills, config)
  const { highlights, killTags } = detectHighlights(
    timeline,
    clutches,
    demo.viewAngles(ticks, steamIds),
    config,
  )

  const ranks = new Map(
    demo.events.rankUpdates.map((r): [string, PlayerRank] => [
      r.steamId,
      {
        mode: modeFromRankType(r.rankTypeId),
        before: r.before,
        after: r.after,
        change: r.change,
        wins: r.wins,
      },
    ]),
  )
  const mode = ranks.values().next().value?.mode ?? null

  return {
    timeline,
    clutches,
    stats,
    highlights,
    killTags,
    mode,
    ranks,
    crosshairs: latestCrosshairs(snapshots),
  }
}

export const readDemoFile = async (path: string) => Buffer.from(await Bun.file(path).arrayBuffer())
