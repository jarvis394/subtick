import { hostname } from 'node:os'
import { RedisClient } from 'bun'
import { SubtickApiError, createSubtickApi } from './api'
import { createStatus } from './fleet'
import { RECORDER_VERSION } from './record'
import { VERSION } from './self'

const TIMEOUT_MS = 5000

const withTimeout = <T>(promise: Promise<T>, what: string) =>
  Promise.race([
    promise,
    Bun.sleep(TIMEOUT_MS).then(() => {
      throw new Error(`${what}: no answer in ${TIMEOUT_MS / 1000} s`)
    }),
  ])

/** The address without its password, for messages. */
export const redactUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.password) parsed.password = '***'

    return parsed.toString()
  } catch {
    return '(not a URL)'
  }
}

/** Connects to Redis and pings it once, without the retries the worker's connection has. */
export const checkRedis = async (url: string) => {
  const client = new RedisClient(url, {
    connectionTimeout: TIMEOUT_MS,
    autoReconnect: false,
    maxRetries: 0,
  })
  try {
    await withTimeout(client.ping(), `Redis at ${redactUrl(url)}`)
  } finally {
    client.close()
  }
}

/**
 * Reaches subtick's recorder api and has it check the token with one heartbeat, as a starting
 * machine; throws with what went wrong.
 */
export const checkSubtick = (url: string, token: string) =>
  withTimeout(
    createSubtickApi({ url, token }).heartbeat({
      ...createStatus(),
      hostname: hostname(),
      gpu: null,
      version: `v${RECORDER_VERSION}`,
      buildVersion: VERSION,
    }),
    `subtick at ${url}`,
  )

/**
 * Reaches subtick's recorder api and checks the token without reporting anything; `null` when the
 * server is older than the read-only check. Throws with what went wrong.
 */
export const checkToken = (url: string, token: string) =>
  withTimeout(
    createSubtickApi({ url, token })
      .whoami()
      .catch((error: unknown) => {
        if (error instanceof SubtickApiError && error.status === 404) return null
        throw error
      }),
    `subtick at ${url}`,
  )
