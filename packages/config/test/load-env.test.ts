import { describe, expect, test } from 'bun:test'
import { RedisEnv, SteamEnv, loadEnv } from '../src'

const shape = { ...RedisEnv, ...SteamEnv }
const base = { REDIS_URL: 'redis://localhost:6379' }

describe('loadEnv', () => {
  test('development starts without a Steam API key, and empty counts as unset', () => {
    expect(loadEnv(shape, base).STEAM_API_KEY).toBeUndefined()
    expect(loadEnv(shape, { ...base, STEAM_API_KEY: '' }).STEAM_API_KEY).toBeUndefined()
  })

  test('production refuses to start without one', () => {
    for (const STEAM_API_KEY of [undefined, ''])
      expect(() => loadEnv(shape, { ...base, NODE_ENV: 'production', STEAM_API_KEY })).toThrow(
        /STEAM_API_KEY/,
      )
    expect(
      loadEnv(shape, { ...base, NODE_ENV: 'production', STEAM_API_KEY: 'key' }).STEAM_API_KEY,
    ).toBe('key')
  })

  test('the production rule only applies to shapes that read the variable', () => {
    expect(loadEnv(RedisEnv, { ...base, NODE_ENV: 'production' })).toEqual(base)
  })

  test('lists production and schema problems together', () => {
    expect(() => loadEnv(shape, { NODE_ENV: 'production' })).toThrow(
      /REDIS_URL[\s\S]*STEAM_API_KEY|STEAM_API_KEY[\s\S]*REDIS_URL/,
    )
  })
})
