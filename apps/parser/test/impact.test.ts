import { IMPACT_MAX, IMPACT_MIN } from '@subtick/domain'
import { describe, expect, test } from 'bun:test'
import { computeImpact, scaleImpact, winProbability } from '../src/impact'
import { CT, T, buildTestTimeline, roundTick } from './builders'

const equip = new Map([...CT, ...T].map((id) => [id, 4500]))

const state = (ct: number, t: number, planted = false) => ({
  alive: { CT: new Set(CT.slice(0, ct)), T: new Set(T.slice(0, t)) },
  planted,
})

describe('winProbability', () => {
  test('even at 5v5, rises with the man advantage and the plant', () => {
    expect(winProbability(state(5, 5), equip, 'CT')).toBeCloseTo(0.5)
    expect(winProbability(state(5, 4), equip, 'CT')).toBeGreaterThan(0.65)
    expect(winProbability(state(4, 4, true), equip, 'T')).toBeGreaterThan(0.7)
  })

  test('better equipment wins more often', () => {
    const eco = new Map([...equip, ...T.map((id): [string, number] => [id, 800])])
    expect(winProbability(state(5, 5), eco, 'CT')).toBeGreaterThan(0.8)
  })

  test('a wiped team only keeps its chance through the bomb', () => {
    expect(winProbability(state(0, 3), equip, 'CT')).toBe(0)
    expect(winProbability(state(2, 0, true), equip, 'CT')).toBeLessThan(1)
  })
})

describe('scaleImpact', () => {
  test('stays within the range and keeps order', () => {
    expect(scaleImpact(500)).toBeLessThanOrEqual(IMPACT_MAX)
    expect(scaleImpact(-500)).toBeGreaterThanOrEqual(IMPACT_MIN)
    expect(scaleImpact(5)).toBeGreaterThan(scaleImpact(4))
    expect(scaleImpact(0)).toBe(0)
  })
})

describe('computeImpact', () => {
  test('an ace is worth more than one kill, deaths cost, traded deaths cost less', () => {
    const impact = computeImpact(
      buildTestTimeline([
        {
          winner: 'CT',
          kills: [
            { at: 1, attacker: 't1', victim: 'ct1' },
            { at: 3, attacker: 'ct2', victim: 't1' },
            ...T.slice(1).map((victim, i) => ({ at: 20 + i, attacker: 'ct2', victim })),
          ],
        },
        {
          winner: 'T',
          kills: [{ at: 1, attacker: 't2', victim: 'ct3' }],
          endsAt: 100,
        },
      ]),
    )

    expect(impact.get('ct2')!).toBeGreaterThan(impact.get('t1')!)
    expect(impact.get('ct3')!).toBeLessThan(0)
    // ct1 was traded by ct2 within the window; ct3 was not.
    expect(impact.get('ct1')!).toBeGreaterThan(impact.get('ct3')!)
    expect(impact.get('ct5')).toBe(0)
  })

  test('armor-only hits on the victim do not break the damage share', () => {
    const timeline = buildTestTimeline([
      { winner: 'CT', kills: [{ at: 5, attacker: 'ct1', victim: 't1' }] },
    ])
    timeline.damages.push({
      round: 1,
      tick: roundTick(1, 2),
      attacker: 'ct2',
      victim: 't1',
      weapon: 'ak47',
      amount: 0,
      isTeamDamage: false,
    })

    expect(Number.isFinite(computeImpact(timeline).get('ct1'))).toBe(true)
  })

  test('a defuse earns what the round had left to win', () => {
    const impact = computeImpact(
      buildTestTimeline([{ winner: 'CT', defuse: { at: 90, steamId: 'ct4' } }]),
    )

    expect(impact.get('ct4')!).toBeGreaterThan(0)
  })
})
