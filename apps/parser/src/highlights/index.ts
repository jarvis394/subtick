import type { Highlight, KillTag } from '@subtick/domain'
import type { ViewAngleSample } from '../demo'
import type { Clutch } from '../clutches'
import type { MatchTimeline } from '../timeline'
import { type HighlightConfig, highlightConfig } from './config'
import { detectFlicks } from './flicks'
import { tagKills } from './kill-tags'
import { buildMoments } from './moments'
import { momentKind, momentTags, momentTitle, scoreMoment } from './score'

export { flickSampleRequest } from './flicks'
export { highlightConfig, type HighlightConfig } from './config'

/**
 * Finds every highlight candidate in the match, scores it, and keeps the best ones per player:
 * timeline → kill tags → moments → score/kind/title → selection.
 */
export const detectHighlights = (
  timeline: MatchTimeline,
  clutches: Clutch[],
  viewAngles: ViewAngleSample[],
  config: HighlightConfig = highlightConfig,
): { highlights: Highlight[]; killTags: Map<number, KillTag[]> } => {
  const flicks = detectFlicks(timeline.kills, viewAngles, config)
  const killTags = tagKills(timeline, flicks, config)
  const totalRounds = timeline.rounds.length

  const candidates = buildMoments(timeline, clutches, config).map((moment): Highlight => {
    const tags = momentTags(moment, totalRounds)
    const kind = momentKind(moment, killTags)
    return {
      steamId: moment.steamId,
      playerName: timeline.players.get(moment.steamId)?.name ?? moment.steamId,
      round: moment.round.number,
      kind,
      title: momentTitle(moment, kind, killTags),
      score: scoreMoment(moment, killTags, tags, config),
      startTick: moment.startTick,
      endTick: moment.endTick,
      kills: moment.kills.map((k) => ({
        tick: k.tick,
        victimSteamId: k.victim,
        victimName: k.victimName,
        weapon: k.weapon,
        tags: killTags.get(k.id) ?? [],
      })),
      tags,
      clutch: moment.clutch && {
        opponents: moment.clutch.opponents,
        won: moment.clutch.won,
        startTick: moment.clutch.startTick,
      },
    }
  })

  const byPlayer = Map.groupBy(
    candidates.filter((h) => h.score >= config.select.minScore),
    (h) => h.steamId,
  )
  const highlights = [...byPlayer.values()]
    .flatMap((list) =>
      list.toSorted((a, b) => b.score - a.score).slice(0, config.select.maxPerPlayer),
    )
    .toSorted((a, b) => a.startTick - b.startTick)

  return { highlights, killTags }
}
