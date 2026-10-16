import { and, eq, schema } from '@subtick/db'
import { type MatchEvent, createMatchEventHub } from '@subtick/queue'
import { Elysia, sse } from 'elysia'
import type { Context } from '../context'
import { authGuard } from './guard'

const HEARTBEAT_MS = 25_000

/**
 * Server-sent pipeline progress for the user's matches. Workers publish to Redis; each api process
 * holds one subscription and forwards only events for matches the user is linked to.
 */
export const eventRoutes = ({ db, auth, env }: Context) => {
  const listen = createMatchEventHub(env.REDIS_URL)

  return new Elysia().use(authGuard(auth)).get(
    '/events',
    async function* ({ user, request }) {
      const known = new Set<string>()
      const isMine = async (matchId: string) => {
        if (known.has(matchId)) return true
        const [row] = await db
          .select({ matchId: schema.userMatch.matchId })
          .from(schema.userMatch)
          .where(and(eq(schema.userMatch.userId, user.id), eq(schema.userMatch.matchId, matchId)))
        if (row) known.add(matchId)
        return Boolean(row)
      }

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
          const event = pending.shift()!
          // oxlint-disable-next-line no-await-in-loop -- events are forwarded in order
          if (await isMine(event.matchId)) yield sse({ event: 'match', data: event })
        }
      } finally {
        clearInterval(heartbeat)
        unlisten()
      }
    },
    { auth: true },
  )
}
