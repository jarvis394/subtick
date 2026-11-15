import { describe, expect, test } from 'bun:test'
import { detectClutches } from '../src/clutches'
import { computeStats } from '../src/stats'
import { buildTestTimeline, roundTick } from './builders'

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

  test('post-round kills, damage and flashes stay out of round stats', () => {
    const t = buildTestTimeline([
      {
        winner: 'CT',
        endsAt: 10,
        kills: [{ at: 20, attacker: 'ct1', victim: 't1', afterRoundEnd: true }],
      },
    ])
    t.damages.push(
      {
        round: 1,
        tick: roundTick(1, 5),
        attacker: 'ct1',
        victim: 't2',
        weapon: 'ak47',
        amount: 50,
        isTeamDamage: false,
        hitgroup: 'chest',
      },
      {
        round: 1,
        tick: roundTick(1, 21),
        attacker: 'ct1',
        victim: 't1',
        weapon: 'ak47',
        amount: 100,
        isTeamDamage: false,
        hitgroup: 'chest',
      },
    )
    t.blinds.push(
      {
        round: 1,
        tick: roundTick(1, 6),
        attacker: 'ct1',
        victim: 't2',
        duration: 2,
        isTeamFlash: false,
      },
      {
        round: 1,
        tick: roundTick(1, 22),
        attacker: 'ct1',
        victim: 't3',
        duration: 2,
        isTeamFlash: false,
      },
    )
    const after = stats(t)

    expect(after.get('ct1')).toMatchObject({
      kills: 0,
      damage: 50,
      enemiesFlashed: 1,
      multiKills: [0, 0, 0, 0, 0],
      kastRounds: 1,
    })
    expect(after.get('t1')).toMatchObject({ deaths: 0, kastRounds: 1 })
    expect(after.get('t2')).toMatchObject({ kastRounds: 1 })
  })
})
