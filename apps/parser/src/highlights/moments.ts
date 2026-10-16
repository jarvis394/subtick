import { otherSide, secondsToTicks } from '@subtick/domain'
import { type Clutch, aliveAt } from '../clutches'
import { isEnemyKill } from '../stats'
import type { BombEvent, Kill, MatchTimeline, Round } from '../timeline'
import type { HighlightConfig } from './config'

/** A contiguous piece of one player's round worth showing: kills, a clutch, a defuse. */
export interface Moment {
  steamId: string
  round: Round
  kills: Kill[]
  clutch: Clutch | null
  defuse: BombEvent | null
  ninjaDefuse: boolean
  opening: boolean
  startTick: number
  endTick: number
}

type Draft = Omit<Moment, 'startTick' | 'endTick' | 'opening'>

/** Splits kills into runs where consecutive kills are at most `gap` ticks apart. */
const splitByGap = (kills: Kill[], gap: number) => {
  const groups: Kill[][] = []
  for (const k of kills) {
    const last = groups.at(-1)
    if (last && k.tick - last.at(-1)!.tick <= gap) last.push(k)
    else groups.push([k])
  }
  return groups
}

const toTicks = (config: HighlightConfig) => {
  const w = config.window
  return {
    pre: secondsToTicks(w.preRollSeconds),
    post: secondsToTicks(w.postRollSeconds),
    gap: secondsToTicks(w.mergeGapSeconds),
    max: secondsToTicks(w.maxClipSeconds),
    maxLong: secondsToTicks(w.maxLongClipSeconds),
    leadIn: secondsToTicks(w.clutchLeadInSeconds),
    maxLead: secondsToTicks(w.clutchMaxLeadSeconds),
    defuseLeadIn: secondsToTicks(w.defuseLeadInSeconds),
  }
}

/** Where a clutch clip starts: shortly before the 1vN begins, or closer to its first kill. */
const clutchStart = (clutch: Clutch, kills: Kill[], t: ReturnType<typeof toTicks>) => {
  const firstClutchKill = kills.find((k) => k.tick >= clutch.startTick)
  const start = clutch.startTick - t.leadIn
  return firstClutchKill ? Math.max(start, firstClutchKill.tick - t.maxLead) : start
}

/**
 * Picks the clip window around the moment's kills, clutch and defuse. A clutch without kills or a
 * defuse runs to the end of the round. When a window is too long, the earliest part is cut (and
 * kills in it dropped): endings matter more.
 */
const finalize = (
  draft: Draft,
  config: HighlightConfig,
  openingKillId: number | undefined,
): Moment | null => {
  const t = toTicks(config)
  const { round, kills, clutch, defuse } = draft
  const isLong = kills.length >= config.window.longClipMinKills || clutch !== null
  const max = isLong ? t.maxLong : t.max

  const starts = [
    ...(kills.length ? [kills[0]!.tick - t.pre] : []),
    ...(clutch ? [clutchStart(clutch, kills, t)] : []),
    ...(defuse && !kills.length ? [defuse.tick - t.defuseLeadIn] : []),
  ]
  const ends = [
    ...(kills.length ? [kills.at(-1)!.tick + t.post] : []),
    ...(defuse ? [defuse.tick + t.post] : []),
  ]
  if (!starts.length) return null

  const endTick = Math.min(Math.max(...ends), round.lastTick)
  const startTick = Math.max(Math.min(...starts), round.freezeEndTick, endTick - max)
  const kept = kills.filter((k) => k.tick >= startTick)
  // A clutch won without a kill or a defuse (time ran out, bomb exploded) is not worth a clip.
  if (!kept.length && !defuse) return null

  return {
    ...draft,
    kills: kept,
    opening: kept.some((k) => k.id === openingKillId),
    startTick,
    endTick,
  }
}

export const buildMoments = (
  timeline: MatchTimeline,
  clutches: Clutch[],
  config: HighlightConfig,
) => {
  const t = toTicks(config)
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
      const kills = byPlayer.get(steamId) ?? []
      const clutch =
        clutches.find((c) => c.round === round.number && c.steamId === steamId && c.won) ?? null
      const ownDefuse = defuse?.steamId === steamId ? defuse : null
      const base = { steamId, round, clutch: null, defuse: null, ninjaDefuse: false }

      let drafts: Draft[]
      const span = kills.length ? kills.at(-1)!.tick - kills[0]!.tick + t.pre + t.post : 0
      if (clutch) {
        // Earlier kills join the clutch clip only if they lead straight into it.
        const start = clutchStart(clutch, kills, t)
        const groups = splitByGap(
          kills.filter((k) => k.tick < clutch.startTick),
          t.gap,
        )
        const leading = groups.at(-1)
        const joins = leading !== undefined && start - leading.at(-1)!.tick <= t.gap
        const clutchKills = kills.filter((k) => k.tick >= clutch.startTick)
        drafts = [
          ...(joins ? groups.slice(0, -1) : groups).map((group) => ({ ...base, kills: group })),
          { ...base, kills: [...(joins ? leading : []), ...clutchKills] },
        ]
      } else if (span <= (kills.length >= config.window.longClipMinKills ? t.maxLong : t.max)) {
        drafts = [{ ...base, kills }]
      } else {
        drafts = splitByGap(kills, t.gap).map((group) => ({ ...base, kills: group }))
      }

      // The clutch and the defuse belong to the last piece of the round.
      const last = drafts.at(-1)!
      last.clutch = clutch
      if (ownDefuse) {
        last.defuse = ownDefuse
        last.ninjaDefuse = ninjaDefuse
      }

      for (const draft of drafts) {
        const moment = finalize(draft, config, openingKillId)
        if (moment) moments.push(moment)
      }
    }
  }

  return moments
}
