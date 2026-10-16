import { describe, expect, test } from 'bun:test'
import { detectClutches } from '../src/clutches'
import { buildTestTimeline } from './builders'

describe('detectClutches', () => {
  test('finds a won 1v3 and the opposing lost 1v1', () => {
    const timeline = buildTestTimeline([
      {
        winner: 'CT',
        kills: [
          { at: 1, attacker: 'ct1', victim: 't1' },
          { at: 2, attacker: 'ct1', victim: 't2' },
          { at: 10, attacker: 't3', victim: 'ct1' },
          { at: 11, attacker: 't3', victim: 'ct2' },
          { at: 12, attacker: 't4', victim: 'ct3' },
          { at: 13, attacker: 't4', victim: 'ct4' },
          { at: 30, attacker: 'ct5', victim: 't3' },
          { at: 31, attacker: 'ct5', victim: 't4' },
          { at: 40, attacker: 'ct5', victim: 't5' },
        ],
      },
    ])

    const clutches = detectClutches(timeline)
    expect(clutches).toHaveLength(2)
    expect(clutches.find((c) => c.side === 'CT')).toMatchObject({
      steamId: 'ct5',
      opponents: 3,
      won: true,
      kills: 3,
    })
    expect(clutches.find((c) => c.side === 'T')).toMatchObject({
      steamId: 't5',
      opponents: 1,
      won: false,
    })
  })

  test('deaths on the same tick are applied together (1v1 for both, not 1v2)', () => {
    const kills = [
      { at: 1, attacker: 'ct1', victim: 't1' },
      { at: 2, attacker: 'ct1', victim: 't2' },
      { at: 3, attacker: 'ct1', victim: 't3' },
      { at: 4, attacker: 't4', victim: 'ct2' },
      { at: 5, attacker: 't4', victim: 'ct3' },
      { at: 6, attacker: 't4', victim: 'ct4' },
      { at: 7, attacker: 't4', victim: 'ct5' },
      { at: 7, attacker: 'ct5', victim: 't4' },
      { at: 9, attacker: 'ct1', victim: 't5' },
    ]
    const clutches = detectClutches(buildTestTimeline([{ winner: 'CT', kills }]))
    const summary = clutches.map((c) => [c.steamId, c.opponents, c.won]).toSorted()
    expect(summary).toEqual([
      ['ct1', 1, true],
      ['t5', 1, false],
    ])
  })

  test('no clutch when the round ends with several players alive', () => {
    const timeline = buildTestTimeline([
      { winner: 'T', kills: [{ at: 1, attacker: 't1', victim: 'ct1' }], endsAt: 90 },
    ])
    expect(detectClutches(timeline)).toEqual([])
  })
})
