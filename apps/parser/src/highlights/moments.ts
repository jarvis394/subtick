import { type ClipSegment, otherSide, secondsToTicks, segmentsTicks } from '@subtick/domain'
import { type Clutch, aliveAt } from '../clutches'
import { isEnemyKill } from '../stats'
import type { BombEvent, Kill, MatchTimeline, Round } from '../timeline'
import type { HighlightConfig } from './config'

/** Everything one player did in a round worth showing: their kills, a clutch, a defuse. */
export interface Moment {
  steamId: string
  round: Round
  kills: Kill[]
  clutch: Clutch | null
  defuse: BombEvent | null
  ninjaDefuse: boolean
  opening: boolean
  /** The footage the clip plays, back to back: each kill with padding, close ones merged. */
  segments: ClipSegment[]
  startTick: number
  endTick: number
}

type Draft = Omit<Moment, 'segments' | 'startTick' | 'endTick' | 'opening'>

/** Merges windows that overlap or sit closer than `minCut`: a cut that short is just a jump. */
const mergeWindows = (windows: ClipSegment[], minCut: number) => {
  const merged: ClipSegment[] = []
  for (const w of windows.toSorted((a, b) => a.startTick - b.startTick)) {
    const last = merged.at(-1)
    if (last && w.startTick - last.endTick < minCut)
      last.endTick = Math.max(last.endTick, w.endTick)
    else merged.push({ ...w })
  }
  return merged
}

/**
 * Picks the footage: every kill with padding on both sides, and the run-up to a defuse, cut
 * together where they are far apart. When it all runs too long, the earliest segments are dropped
 * (and their kills with them): endings matter more.
 */
const finalize = (
  draft: Draft,
  config: HighlightConfig,
  openingKillId: number | undefined,
): Moment | null => {
  const w = config.window
  const pad = secondsToTicks(w.killPaddingSeconds)
  const { round, kills, defuse } = draft
  const clamp = (s: ClipSegment): ClipSegment => ({
    startTick: Math.max(s.startTick, round.freezeEndTick),
    endTick: Math.min(s.endTick, round.lastTick),
  })
  const windows = [
    ...kills.map((k) => ({ startTick: k.tick - pad, endTick: k.tick + pad })),
    ...(defuse
      ? [
          {
            startTick: defuse.tick - secondsToTicks(w.defuseLeadInSeconds),
            endTick: defuse.tick + pad,
          },
        ]
      : []),
  ]
    .map(clamp)
    .filter((s) => s.endTick > s.startTick)
  const segments = mergeWindows(windows, secondsToTicks(w.minCutSeconds))

  const max = secondsToTicks(w.maxClipSeconds)
  let total = segmentsTicks(segments)
  while (total > max && segments.length > 1) total -= segmentsTicks(segments.splice(0, 1))
  // A single segment that is still too long keeps its end.
  if (total > max) segments[0]!.startTick = segments[0]!.endTick - max

  const startTick = segments[0]?.startTick
  const endTick = segments.at(-1)?.endTick
  if (startTick === undefined || endTick === undefined) return null
  const kept = kills.filter((k) => k.tick >= startTick)
  // A clutch won without a kill or a defuse (time ran out, bomb exploded) is not worth a clip.
  if (!kept.length && !defuse) return null

  return {
    ...draft,
    kills: kept,
    opening: kept.some((k) => k.id === openingKillId),
    segments,
    startTick,
    endTick,
  }
}

export const buildMoments = (
  timeline: MatchTimeline,
  clutches: Clutch[],
  config: HighlightConfig,
) => {
  const killsByRound = Map.groupBy(timeline.kills.filter(isEnemyKill), (k) => k.round)
  const allKillsByRound = Map.groupBy(timeline.kills, (k) => k.round)
  const moments: Moment[] = []

  for (const round of timeline.rounds) {
    const roundKills = killsByRound.get(round.number) ?? []
    const openingKillId = roundKills.find((k) => !k.afterRoundEnd)?.id
    const defuse = timeline.defuses.find((d) => d.round === round.number) ?? null
    // Ninja defuse: enemies still alive when the defuse completes.
    const defuserSide = defuse?.steamId ? round.sides.get(defuse.steamId) : undefined
    const ninjaDefuse =
      defuse !== null &&
      defuserSide !== undefined &&
      aliveAt(round, allKillsByRound.get(round.number) ?? [], defuse.tick)[otherSide(defuserSide)]
        .size > 0

    const byPlayer = Map.groupBy(roundKills, (k) => k.attacker!)
    const players = new Set([...byPlayer.keys(), ...(defuse?.steamId ? [defuse.steamId] : [])])
    for (const c of clutches) if (c.round === round.number && c.won) players.add(c.steamId)

    for (const steamId of players) {
      const moment = finalize(
        {
          steamId,
          round,
          kills: byPlayer.get(steamId) ?? [],
          clutch:
            clutches.find((c) => c.round === round.number && c.steamId === steamId && c.won) ??
            null,
          defuse: defuse?.steamId === steamId ? defuse : null,
          ninjaDefuse: defuse?.steamId === steamId && ninjaDefuse,
        },
        config,
        openingKillId,
      )
      if (moment) moments.push(moment)
    }
  }

  return moments
}
