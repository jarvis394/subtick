import { describe, expect, test } from 'bun:test'
import type { DemoBlind, DemoEvents, PlayerSnapshot } from '../src/demo'
import { buildTimeline } from '../src/timeline'

const SNAPSHOT_TICKS = [300, 400]
const ROUND_START = 200
const FREEZE_END = 300
const BUY_TIME_END = 400
const ROUND_END = 5000

const event = (blinds: DemoBlind[]): DemoEvents => ({
  matchStarts: [100],
  roundStarts: [ROUND_START],
  freezeEnds: [FREEZE_END],
  buyTimeEnds: [BUY_TIME_END],
  roundEnds: [{ tick: ROUND_END, winner: 'CT', reason: 't_killed' }],
  kills: [],
  damages: [],
  blinds,
  shots: [],
  bombPlants: [],
  bombDefuses: [],
  bombExplosions: [],
  rankUpdates: [],
})

const snapshot = (tick: number, steamId: string, teamNum: number): PlayerSnapshot => ({
  tick,
  steamId,
  teamNum,
  isAlive: true,
  equipValue: 0,
  crosshairCode: null,
})

const player = (steamId: string, teamNum: number | null): DemoBlind['attacker'] => ({
  steamId,
  name: steamId,
  teamNum,
})

const flash = (attacker: DemoBlind['attacker'], victim: DemoBlind['victim']): DemoBlind => ({
  tick: 1000,
  attacker,
  victim,
  duration: 2,
})

const teamFlashes = (blinds: DemoBlind[]) => {
  const snapshots = SNAPSHOT_TICKS.flatMap((tick) => [
    snapshot(tick, 'ct1', 3),
    snapshot(tick, 'ct2', 3),
    snapshot(tick, 't1', 2),
  ])

  return buildTimeline({
    header: { map: 'de_test', serverName: '' },
    players: [],
    events: event(blinds),
    snapshots,
  }).blinds.map((b) => b.isTeamFlash)
}

describe('buildTimeline blinds', () => {
  test('a flash is a team flash only between two known teammates', () => {
    expect(
      teamFlashes([
        flash(player('ct1', 3), player('ct2', 3)),
        flash(player('ct1', 3), player('t1', 2)),
        flash(player('ghost1', null), player('ghost2', null)),
      ]),
    ).toEqual([true, false, false])
  })
})
