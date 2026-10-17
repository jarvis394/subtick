import { type MatchEvent, createMatchEventHub } from '@subtick/queue'
import { Elysia, sse } from 'elysia'
import type { Context } from '../context'
import { authGuard } from './guard'

const HEARTBEAT_MS = 25_000

/**
 * Server-sent pipeline progress. Workers publish to Redis; each api process holds one subscription
 * and forwards every match's events, since any match and clip is viewable by anyone signed in.
 */
export const eventRoutes = ({ auth, env }: Context) => {
  const listen = createMatchEventHub(env.REDIS_URL)

  return new Elysia().use(authGuard(auth)).get(
    '/events',
    async function* ({ request }) {
      // Bridge the push-based hub into this pull-based generator.
      const pending: MatchEvent[] = []
      let wake: (() => void) | null = null
      const notify = () => {
        wake?.()
        wake = null
      }
      const unlisten = listen((event) => {
        pending.push(event)
        notify()
      })
      const heartbeat = setInterval(notify, HEARTBEAT_MS)
      request.signal.addEventListener('abort', notify)

      try {
        yield sse({ event: 'ready', data: {} })
        while (!request.signal.aborted) {
          if (pending.length === 0) {
            // oxlint-disable-next-line no-await-in-loop -- a stream waits for each next event by design
            await new Promise<void>((resolve) => (wake = resolve))
            if (pending.length === 0 && !request.signal.aborted)
              yield sse({ event: 'ping', data: {} })
            continue
          }
          yield sse({ event: 'match', data: pending.shift()! })
        }
      } finally {
        clearInterval(heartbeat)
        unlisten()
      }
    },
    { auth: true },
  )
}
