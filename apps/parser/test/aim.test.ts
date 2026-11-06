import { describe, expect, test } from 'bun:test'
import { aimRating, burstStarts, computeAim, positionSampleRequest } from '../src/aim'
import type { Shot } from '../src/timeline'
import { buildTestTimeline, roundTick } from './builders'

const shot = (at: number, steamId = 'ct1', weapon = 'ak47'): Shot => ({
  round: 1,
  tick: roundTick(1, at),
  steamId,
  weapon,
})

const hit = (at: number, hitgroup: string, attacker = 'ct1', weapon = 'ak47') => ({
  round: 1,
  tick: roundTick(1, at),
  attacker,
  victim: 't1',
  weapon,
  amount: 27,
  isTeamDamage: false,
  hitgroup,
})

describe('burstStarts', () => {
  test('a pause starts a new burst; knives and grenades are not shots', () => {
    const shots = [shot(1), shot(1.1), shot(1.2), shot(3), shot(3.5, 'ct1', 'knife'), shot(4)]

    expect(burstStarts(shots).map((s) => s.tick)).toEqual([1, 3, 4].map((at) => roundTick(1, at)))
    expect(positionSampleRequest(shots).steamIds).toEqual(['ct1'])
  })
})

describe('aimRating', () => {
  test('scales between anchors and skips parts without samples', () => {
    const none = { part: 0, whole: 0 }
    const perfect = { part: 1, whole: 1 }

    expect(
      aimRating({
        accuracy: perfect,
        headHits: perfect,
        headshotKills: perfect,
        counterStrafe: perfect,
      }),
    ).toBe(100)
    expect(
      aimRating({ accuracy: none, headHits: none, headshotKills: none, counterStrafe: none }),
    ).toBe(0)
    expect(
      aimRating({ accuracy: perfect, headHits: none, headshotKills: none, counterStrafe: none }),
    ).toBe(100)
  })
})

describe('computeAim', () => {
  test('counts gun shots, enemy hits, head hits and counter-strafed bursts', () => {
    const timeline = buildTestTimeline([
      { winner: 'CT', kills: [{ at: 4, attacker: 'ct1', victim: 't1', headshot: true }] },
    ])
    timeline.shots.push(shot(1), shot(1.1), shot(1.2), shot(3), shot(3.2, 'ct1', 'nova'))
    timeline.damages.push(hit(1.1, 'chest'), hit(3, 'head'), hit(3.2, 'chest', 'ct1', 'nova'), {
      ...hit(2, 'head'),
      isTeamDamage: true,
    })
    // 2 ticks apart at 64 tick: 6.25 units is 200 u/s, 0.3 units about 10 u/s.
    const aim = computeAim(timeline, [
      { tick: roundTick(1, 1) - 2, steamId: 'ct1', x: 0, y: 0 },
      { tick: roundTick(1, 1), steamId: 'ct1', x: 6.25, y: 0 },
      { tick: roundTick(1, 3) - 2, steamId: 'ct1', x: 0, y: 0 },
      { tick: roundTick(1, 3), steamId: 'ct1', x: 0.3, y: 0 },
    ]).get('ct1')!

    expect(aim).toMatchObject({ shots: 4, hits: 2, headHits: 1, bursts: 2, counterStrafed: 1 })
    expect(aim.rating).toBeGreaterThan(50)
  })
})
