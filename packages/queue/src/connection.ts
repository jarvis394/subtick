import { createLogger } from '@subtick/logger'
import { RedisClient } from 'bun'

const log = createLogger('redis')

const WARN_AFTER_MS = 5000
const POLL_MS = 1000
const unreachable = new Set<string>()

const host = (url: string) => new URL(url).host

export const isConnectionError = (error: Error) =>
  error.name === 'ConnectionClosedError' ||
  ('code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('ERR_REDIS_CONNECTION'))

/** Logs Redis going away once per process and URL, however many connections notice. */
export const reportDown = (url: string, cause?: Error) => {
  if (unreachable.has(url)) return
  unreachable.add(url)
  log.warn(
    { redis: host(url), ...(cause && { cause: cause.message }) },
    'Redis is unreachable, retrying',
  )
}

const reportUp = (url: string) => {
  if (unreachable.delete(url)) log.info({ redis: host(url) }, 'Redis is reachable again')
}

/**
 * Bun retries a first connect (50 ms doubling to 2 s) only until `connectionTimeout`, and BullMQ
 * never retries a first connect that failed: its worker loop spins on the rejection instead. Bun
 * also gives up after `maxRetries` reconnects, and Redis can be gone for hours.
 */
export const createRedisClient = (url: string) =>
  new RedisClient(url, { maxRetries: 1_000_000, connectionTimeout: 2 ** 31 - 1 })

/**
 * Reports a client that has been disconnected for a while, and when it is back. Bun reconnects
 * silently, calling neither `onclose` nor anything else until it is back, so this polls.
 * Returns the function that stops watching, for a client closed on purpose.
 */
export const watchConnection = (client: RedisClient, url: string) => {
  let downSince: number | undefined

  const check = () => {
    if (client.connected) {
      downSince = undefined
      reportUp(url)
    } else {
      downSince ??= Date.now()
      if (Date.now() - downSince >= WARN_AFTER_MS) reportDown(url)
    }
  }

  const timer = setInterval(check, POLL_MS).unref()

  return () => clearInterval(timer)
}
