/**
 * End-to-end analysis of real Premier demos. Invariants catch logic bugs; the snapshot catches
 * unintended changes in what gets highlighted (update with `bun test --update-snapshots` when a
 * change is intended, and bump PARSER_VERSION).
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import {
  MAX_HEALTH,
  ROUNDS_PER_HALF,
  TEAM_SIZE,
  secondsToTicks,
  ticksToSeconds,
  winsNeeded,
} from '@subtick/domain'
import { type MatchAnalysis, analyzeDemo, readDemoFile } from '../src/analyze'
import { highlightConfig } from '../src/highlights'
import { isEnemyKill } from '../src/stats'
import { fixturePath, hasFixture } from './fixtures'

const DEMOS = [
  {
    name: '003848529647721512967_1183300926',
    map: 'de_inferno',
    score: { CT: 8, T: 13 },
    rounds: 21,
  },
  {
    name: '003848529815225237570_0369033508',
    map: 'de_ancient',
    score: { CT: 13, T: 6 },
    rounds: 19,
  },
  {
    name: '003848530066480824350_1006508005',
    map: 'de_vertigo',
    score: { CT: 8, T: 13 },
    rounds: 21,
  },
]

for (const demo of DEMOS) {
  describe.skipIf(!hasFixture(demo.name))(`${demo.map} (${demo.name})`, () => {
    let a: MatchAnalysis

    beforeAll(async () => {
      a = analyzeDemo(await readDemoFile(fixturePath(demo.name)))
    }, 30_000)

    test('header, rounds and final score', () => {
      expect(a.timeline.header.map).toBe(demo.map)
      expect(a.timeline.rounds).toHaveLength(demo.rounds)
      expect(a.timeline.finalScore).toEqual(demo.score)
      expect(Math.max(demo.score.CT, demo.score.T)).toBe(winsNeeded(0))
    })

    test('rounds are ordered and do not overlap', () => {
      for (const [i, r] of a.timeline.rounds.entries()) {
        expect(r.number).toBe(i + 1)
        expect(r.startTick).toBeLessThanOrEqual(r.freezeEndTick)
        expect(r.freezeEndTick).toBeLessThan(r.endTick)
        expect(r.endTick).toBeLessThanOrEqual(r.lastTick)
        expect(r.sides.size).toBe(TEAM_SIZE * 2)
        const next = a.timeline.rounds[i + 1]
        if (next) expect(r.lastTick).toBeLessThan(next.startTick)
      }
    })

    test('ten players, five per starting side, sides swap at half-time', () => {
      const players = [...a.timeline.players.values()]
      expect(players).toHaveLength(TEAM_SIZE * 2)
      expect(players.filter((p) => p.startingSide === 'CT')).toHaveLength(TEAM_SIZE)
      const [first, second] = [a.timeline.rounds[0]!, a.timeline.rounds[ROUNDS_PER_HALF]!]
      for (const p of players) {
        expect(first.sides.get(p.steamId)).toBe(p.startingSide)
        expect(second.sides.get(p.steamId)).not.toBe(p.startingSide)
      }
    })

    test('stats are consistent with the kill feed', () => {
      const stats = [...a.stats.values()]
      const sum = (pick: (s: (typeof stats)[number]) => number) =>
        stats.reduce((n, s) => n + pick(s), 0)

      expect(sum((s) => s.deaths)).toBe(a.timeline.kills.length)
      expect(sum((s) => s.kills)).toBe(a.timeline.kills.filter(isEnemyKill).length)
      expect(sum((s) => s.openingKills)).toBe(demo.rounds)
      for (const s of stats) {
        expect(s.roundsPlayed).toBe(demo.rounds)
        expect(s.multiKills.reduce((n, c, i) => n + c * (i + 1), 0)).toBe(s.kills)
        expect(s.headshotKills).toBeLessThanOrEqual(s.kills)
        expect(s.kastRounds).toBeLessThanOrEqual(s.roundsPlayed)
        expect(s.clutchesWon).toBeLessThanOrEqual(s.clutchesAttempted)
        // Full HP × every enemy is the most anyone can deal in a round.
        expect(s.damage).toBeLessThanOrEqual(MAX_HEALTH * TEAM_SIZE * s.roundsPlayed)
        expect(s.adr).toBeGreaterThan(0)
      }
    })

    test('highlight windows are valid clips', () => {
      const rounds = new Map(a.timeline.rounds.map((r) => [r.number, r]))
      const maxTicks = secondsToTicks(highlightConfig.window.maxLongClipSeconds)

      expect(a.highlights.length).toBeGreaterThan(0)
      for (const h of a.highlights) {
        const round = rounds.get(h.round)!
        expect(h.startTick).toBeGreaterThanOrEqual(round.freezeEndTick)
        expect(h.endTick).toBeLessThanOrEqual(round.lastTick)
        expect(h.endTick - h.startTick).toBeGreaterThan(secondsToTicks(3))
        expect(h.endTick - h.startTick).toBeLessThanOrEqual(maxTicks)
        expect(h.score).toBeGreaterThanOrEqual(highlightConfig.select.minScore)
        for (const k of h.kills) {
          expect(k.tick).toBeGreaterThanOrEqual(h.startTick)
          expect(k.tick).toBeLessThanOrEqual(h.endTick)
        }
        // Every highlight kill is a real, credited kill by this player in this round.
        for (const k of h.kills) {
          const kill = a.timeline.kills.find(
            (x) => x.tick === k.tick && x.victim === k.victimSteamId,
          )
          expect(kill).toMatchObject({ attacker: h.steamId, round: h.round, isTeamKill: false })
        }
      }
    })

    test('highlights per player are capped and do not overlap', () => {
      const byPlayer = Map.groupBy(a.highlights, (h) => h.steamId)
      for (const list of byPlayer.values()) {
        expect(list.length).toBeLessThanOrEqual(highlightConfig.select.maxPerPlayer)
        const sorted = list.toSorted((x, y) => x.startTick - y.startTick)
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]!.startTick).toBeGreaterThanOrEqual(sorted[i - 1]!.startTick)
          const sameKills = sorted[i]!.kills.filter((k) =>
            sorted[i - 1]!.kills.some((p) => p.tick === k.tick),
          )
          expect(sameKills).toEqual([])
        }
      }
    })

    test('highlight selection snapshot', () => {
      const name = (id: string) => a.timeline.players.get(id)?.name ?? id
      const summary = a.highlights
        .toSorted((x, y) => y.score - x.score || x.startTick - y.startTick)
        .map(
          (h) =>
            `r${h.round} ${name(h.steamId)} · ${h.title} · ${h.score} · ${ticksToSeconds(h.endTick - h.startTick).toFixed(1)}s` +
            (h.tags.length ? ` · ${h.tags.join(',')}` : ''),
        )
      expect(summary).toMatchSnapshot()
    })
  })
}
