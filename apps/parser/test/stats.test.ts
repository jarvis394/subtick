import { describe, expect, test } from 'bun:test'
import { detectClutches } from '../src/clutches'
import { computeStats } from '../src/stats'
import { buildTestTimeline } from './builders'

const stats = (timeline: ReturnType<typeof buildTestTimeline>) =>
  computeStats(timeline, detectClutches(timeline))

describe('computeStats', () => {
  const timeline = buildTestTimeline([
    {
      winner: 'CT',
      kills: [
        { at: 1, attacker: 't1', victim: 'ct1', headshot: true },
        { at: 3, attacker: 'ct2', victim: 't1' },
        { at: 20, attacker: 'ct2', victim: 't2', assister: 'ct3' },
        { at: 25, attacker: 'ct2', victim: 't3', assister: 'ct4', assistedFlash: true },
        { at: 30, attacker: null, victim: 't4', weapon: 'world' },
        { at: 40, attacker: 'ct3', victim: 't5' },
      ],
    },
  ])
  const s = stats(timeline)

  test('opening kill, trade and KAST through being traded', () => {
    expect(s.get('t1')).toMatchObject({ kills: 1, openingKills: 1, headshotKills: 1, deaths: 1 })
    expect(s.get('ct1')).toMatchObject({ openingDeaths: 1, kastRounds: 1 })
    expect(s.get('ct2')).toMatchObject({ kills: 3, tradeKills: 1 })
  })

  test('assists vs flash assists, suicides count as deaths only', () => {
    expect(s.get('ct3')).toMatchObject({ assists: 1, flashAssists: 0, kills: 1 })
    expect(s.get('ct4')).toMatchObject({ assists: 0, flashAssists: 1 })
    expect(s.get('t4')).toMatchObject({ deaths: 1, kills: 0, kastRounds: 0 })
  })

  test('multikill histogram and derived percentages', () => {
    expect(s.get('ct2')!.multiKills).toEqual([0, 0, 1, 0, 0])
    expect(s.get('t1')!.hsPercent).toBe(100)
    expect(s.get('ct5')!.kastPercent).toBe(100)
  })

  test('team kills are not credited', () => {
    const tk = stats(
      buildTestTimeline([{ winner: 'T', kills: [{ at: 1, attacker: 'ct1', victim: 'ct2' }] }]),
    )
    expect(tk.get('ct1')!.kills).toBe(0)
    expect(tk.get('ct2')!.deaths).toBe(1)
  })
})
