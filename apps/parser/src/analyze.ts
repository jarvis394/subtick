import type { Highlight, KillTag, PlayerStats } from '@subtick/domain'
import { type Clutch, detectClutches } from './clutches'
import { openDemo } from './demo'
import {
  type HighlightConfig,
  detectHighlights,
  flickSampleRequest,
  highlightConfig,
} from './highlights'
import { computeStats } from './stats'
import { type MatchTimeline, buildTimeline } from './timeline'

/** Bump when analysis output changes, so stored matches can be re-analyzed. */
export const PARSER_VERSION = 1

export interface MatchAnalysis {
  timeline: MatchTimeline
  clutches: Clutch[]
  stats: Map<string, PlayerStats>
  highlights: Highlight[]
  /** Tags of every credited kill, by kill id. */
  killTags: Map<number, KillTag[]>
}

/** Full analysis of one demo. Synchronous and CPU-bound (≈1–2 s for a full match). */
export const analyzeDemo = (
  data: Buffer,
  config: HighlightConfig = highlightConfig,
): MatchAnalysis => {
  const demo = openDemo(data)
  const snapshotTicks = [...new Set([...demo.events.freezeEnds, ...demo.events.buyTimeEnds])]

  const timeline = buildTimeline({
    header: demo.header,
    players: demo.players,
    events: demo.events,
    snapshots: demo.snapshots(snapshotTicks),
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

  return { timeline, clutches, stats, highlights, killTags }
}

export const readDemoFile = async (path: string) => Buffer.from(await Bun.file(path).arrayBuffer())
