import { describe, expect, test } from 'bun:test'
import type { ViewAngleSample } from '../src/demo'
import { highlightConfig } from '../src/highlights'
import { detectFlicks, flickSampleRequest } from '../src/highlights/flicks'
import { buildTestTimeline, roundTick } from './builders'

const timeline = buildTestTimeline([
  {
    winner: 'CT',
    kills: [
      { at: 1, attacker: 'ct1', victim: 't1' },
      { at: 5, attacker: 'ct1', victim: 't2', weapon: 'knife_karambit' },
    ],
  },
])
const killTick = roundTick(1, 1)

/** Yaw for the 10 ticks before the kill, ending at the kill tick. */
const samples = (yaws: number[]): ViewAngleSample[] =>
  yaws.map((yaw, i) => ({ tick: killTick - (yaws.length - 1) + i, steamId: 'ct1', pitch: 0, yaw }))

describe('flicks', () => {
  test('only gun kills are sampled', () => {
    const { ticks, steamIds } = flickSampleRequest(timeline.kills, highlightConfig)
    expect(steamIds).toEqual(['ct1'])
    expect(ticks).toHaveLength(highlightConfig.tags.flickTicks + 1)
    expect(ticks.at(-1)).toBe(killTick)
  })

  test('a fast large rotation is a flick', () => {
    const yaws = [0, 0, 2, 8, 20, 35, 48, 55, 58, 59, 60]
    expect(detectFlicks(timeline.kills, samples(yaws), highlightConfig)).toEqual(new Set([0]))
  })

  test('a slow adjustment is not', () => {
    const yaws = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(detectFlicks(timeline.kills, samples(yaws), highlightConfig).size).toBe(0)
  })

  test('yaw wrap-around (170° → -170°) is a 20° move, not 340°', () => {
    const yaws = [170, 172, 174, 176, 178, 180, -178, -176, -174, -172, -170]
    expect(detectFlicks(timeline.kills, samples(yaws), highlightConfig).size).toBe(0)
  })
})
