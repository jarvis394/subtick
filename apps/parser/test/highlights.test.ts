import { describe, expect, test } from 'bun:test'
import { secondsToTicks } from '@subtick/domain'
import { detectClutches } from '../src/clutches'
import { detectHighlights, highlightConfig, shouldAutoRecord } from '../src/highlights'
import { type RoundSpec, buildTestTimeline, roundTick } from './builders'

const detect = (rounds: RoundSpec[]) => {
  const timeline = buildTestTimeline(rounds)
  return detectHighlights(timeline, detectClutches(timeline), []).highlights
}

const w = highlightConfig.window

/** Two deagle headshots by an under-equipped player. */
const ecoRound = (): RoundSpec => ({
  winner: 'CT',
  kills: [
    { at: 1, attacker: 'ct1', victim: 't1', weapon: 'deagle', headshot: true },
    { at: 2, attacker: 'ct1', victim: 't2', weapon: 'deagle', headshot: true },
  ],
  equip: { ct1: 900 },
  endsAt: 90,
})

describe('detectHighlights', () => {
  test('close kills play as one continuous segment, padded on both ends', () => {
    const [ace, ...rest] = detect([
      {
        winner: 'CT',
        kills: [5, 8, 13, 19, 26].map((at, i) => ({ at, attacker: 'ct1', victim: `t${i + 1}` })),
      },
    ])
    expect(rest).toEqual([])
    expect(ace).toMatchObject({
      kind: 'ace',
      title: 'Ace with the AK-47',
      steamId: 'ct1',
      round: 1,
    })
    expect(ace!.kills).toHaveLength(5)
    const pad = secondsToTicks(w.killPaddingSeconds)
    expect(ace!.segments).toEqual([
      { startTick: roundTick(1, 5) - pad, endTick: roundTick(1, 26) + pad },
    ])
  })

  test('kills spread over a long round are one moment, cut at large gaps', () => {
    const highlights = detect([
      {
        winner: 'CT',
        kills: [
          { at: 1, attacker: 'ct1', victim: 't1', headshot: true },
          { at: 2, attacker: 'ct1', victim: 't2', headshot: true },
          { at: 60, attacker: 'ct1', victim: 't3', headshot: true },
          { at: 61, attacker: 'ct1', victim: 't4', headshot: true },
        ],
        endsAt: 90,
      },
    ])
    expect(highlights.map((h) => [h.kind, h.kills.length, h.segments.length])).toEqual([
      ['quad', 4, 2],
    ])
  })

  test('each kill far from the others gets its own segment', () => {
    const [triple] = detect([
      {
        winner: 'CT',
        kills: [0, 12, 24].map((at, i) => ({ at, attacker: 'ct1', victim: `t${i + 1}` })),
        endsAt: 90,
      },
    ])
    expect(triple).toMatchObject({ kind: 'triple', title: '3K with the AK-47' })
    expect(triple!.segments).toHaveLength(3)
    expect(triple!.startTick).toBe(triple!.segments[0]!.startTick)
    expect(triple!.endTick).toBe(triple!.segments.at(-1)!.endTick)
  })

  test('a title names both weapons when a knife finishes a rifle kill', () => {
    const [double] = detect([
      {
        winner: 'CT',
        kills: [
          { at: 4, attacker: 'ct1', victim: 't1', weapon: 'm4a1_silencer' },
          { at: 6, attacker: 'ct1', victim: 't2', weapon: 'knife' },
        ],
        endsAt: 90,
      },
    ])
    expect(double).toMatchObject({ kind: 'double', title: '2K with the M4A1-S and the knife' })
  })

  test('kills before a clutch count toward it: 2 kills, then a 1v3 for 3 more, is an ace', () => {
    const highlights = detect([
      {
        winner: 'CT',
        kills: [
          { at: 5, attacker: 'ct1', victim: 't1' },
          { at: 6, attacker: 'ct1', victim: 't2' },
          { at: 20, attacker: 't3', victim: 'ct2' },
          { at: 21, attacker: 't3', victim: 'ct3' },
          { at: 22, attacker: 't4', victim: 'ct4' },
          { at: 23, attacker: 't5', victim: 'ct5' },
          { at: 40, attacker: 'ct1', victim: 't3' },
          { at: 45, attacker: 'ct1', victim: 't4' },
          { at: 50, attacker: 'ct1', victim: 't5' },
        ],
      },
    ]).filter((h) => h.steamId === 'ct1')
    expect(highlights).toHaveLength(1)
    expect(highlights[0]).toMatchObject({ kind: 'ace', clutch: { opponents: 3, won: true } })
    expect(highlights[0]!.kills).toHaveLength(5)
    expect(highlights[0]!.segments).toHaveLength(2)
  })

  test('clutch clips skip the walking before the first clutch kill', () => {
    const clutch = detect([
      {
        winner: 'CT',
        kills: [
          { at: 1, attacker: 't1', victim: 'ct1' },
          { at: 2, attacker: 't1', victim: 'ct2' },
          { at: 3, attacker: 't2', victim: 'ct3' },
          { at: 4, attacker: 't2', victim: 'ct4' },
          { at: 40, attacker: 'ct5', victim: 't1' },
          { at: 42, attacker: 'ct5', victim: 't2' },
          { at: 45, attacker: 'ct5', victim: 't3' },
          { at: 47, attacker: 'ct5', victim: 't4' },
          { at: 50, attacker: 'ct5', victim: 't5' },
        ],
      },
    ]).find((h) => h.steamId === 'ct5')
    expect(clutch).toMatchObject({ kind: 'ace', clutch: { opponents: 5, won: true } })
    expect(clutch!.startTick).toBe(roundTick(1, 40) - secondsToTicks(w.killPaddingSeconds))
  })

  test('a clutch ace is the best moment of the match', () => {
    const [first] = detect([
      {
        winner: 'T',
        kills: [
          { at: 1, attacker: 'ct1', victim: 't1' },
          { at: 2, attacker: 'ct1', victim: 't2' },
          { at: 3, attacker: 'ct1', victim: 't3' },
          { at: 4, attacker: 'ct2', victim: 't4' },
          { at: 10, attacker: 't5', victim: 'ct1' },
          { at: 12, attacker: 't5', victim: 'ct2' },
          { at: 14, attacker: 't5', victim: 'ct3' },
          { at: 15, attacker: 't5', victim: 'ct4' },
          { at: 18, attacker: 't5', victim: 'ct5' },
        ],
      },
    ]).toSorted((a, b) => b.score - a.score)
    expect(first).toMatchObject({ steamId: 't5', kind: 'ace', clutch: { opponents: 5 } })
  })

  test('collateral: two victims, one bullet', () => {
    const [h] = detect([
      {
        winner: 'CT',
        kills: [
          { at: 5, attacker: 'ct1', victim: 't1', weapon: 'awp' },
          { at: 5, attacker: 'ct1', victim: 't2', weapon: 'awp' },
        ],
        endsAt: 90,
      },
    ])
    expect(h).toMatchObject({ kind: 'collateral', title: 'Collateral with the AWP' })
    expect(h!.kills.every((k) => k.tags.includes('collateral'))).toBe(true)
  })

  test('eco frags are tagged outside pistol rounds only', () => {
    const highlights = detect([ecoRound(), ecoRound()])
    expect(highlights.find((h) => h.round === 1)!.kills[0]!.tags).not.toContain('eco')
    expect(highlights.find((h) => h.round === 2)!.kills[0]!.tags).toContain('eco')
  })

  test('a ninja defuse is a highlight on its own', () => {
    const [h] = detect([
      {
        winner: 'CT',
        kills: [{ at: 1, attacker: 't1', victim: 'ct1' }],
        defuse: { at: 60, steamId: 'ct2' },
        endsAt: 60,
      },
    ])
    expect(h).toMatchObject({ steamId: 'ct2', kind: 'special', title: 'Ninja defuse' })
    expect(h!.tags).toEqual(expect.arrayContaining(['defuse', 'ninja_defuse']))
  })

  test('single kills are never highlights, however special', () => {
    expect(
      detect([
        {
          winner: 'CT',
          kills: [{ at: 1, attacker: 'ct1', victim: 't1', weapon: 'knife', headshot: true }],
          endsAt: 90,
        },
      ]),
    ).toEqual([])
  })

  test('only 3Ks and up and 1v2+ clutches are recorded on their own', () => {
    const highlights = detect([
      { winner: 'CT', kills: ecoRound().kills, endsAt: 90 },
      {
        winner: 'CT',
        kills: [1, 2, 3].map((at, i) => ({ at, attacker: 'ct1', victim: `t${i + 1}` })),
        endsAt: 90,
      },
      {
        winner: 'CT',
        kills: [
          { at: 1, attacker: 't1', victim: 'ct1' },
          { at: 2, attacker: 't1', victim: 'ct2' },
          { at: 3, attacker: 't2', victim: 'ct3' },
          { at: 4, attacker: 't2', victim: 'ct4' },
          { at: 20, attacker: 'ct5', victim: 't1' },
          { at: 22, attacker: 'ct5', victim: 't2' },
        ],
      },
    ])
    expect(highlights.map((h) => [h.round, h.kind, shouldAutoRecord(h)])).toEqual(
      expect.arrayContaining([
        [1, 'double', false],
        [2, 'triple', true],
        [3, 'clutch', true],
      ]),
    )
  })

  test('at most maxPerPlayer highlights per player, best first', () => {
    const rounds: RoundSpec[] = Array.from({ length: 10 }, () => ({
      winner: 'CT',
      kills: [1, 2, 3].map((at, i) => ({ at, attacker: 'ct1', victim: `t${i + 1}` })),
      endsAt: 90,
    }))
    expect(detect(rounds)).toHaveLength(highlightConfig.select.maxPerPlayer)
  })
})
