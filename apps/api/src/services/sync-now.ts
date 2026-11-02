import { and, eq, gte, inArray, schema, sql } from '@subtick/db'
import { enqueue, queues as registry } from '@subtick/queue'
import type { Context } from '../context'
import { devToolsEnabled } from './dev-flag'

const POLL_MS = 300
/** Past this the answer is "still looking": the worker keeps going and the next poll finds it. */
const MAX_WAIT_MS = 20_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Asks Steam for new matches now instead of at the next scheduled sync, and waits for the sync to
 * finish so the caller can say what it found. Finished jobs are removed from the queue, so a job
 * that is gone means its sync is done. A sync already queued or running is waited for as it is.
 */
export const syncNow = async ({ db, queues, env }: Context, userId: string, steamIds: string[]) => {
  if (!steamIds.length) return { newMatches: 0, done: true }
  // Dev: staged fake matches stand in for what Steam would have found.
  if (devToolsEnabled(env)) {
    const { materializeFakeMatches, stagedFakeMatches } = await import('./dev-matches')
    if (stagedFakeMatches(userId)) {
      await sleep(800)

      return { newMatches: await materializeFakeMatches(db, userId, steamIds[0]!), done: true }
    }
  }
  const startedAt = new Date()
  await Promise.all(steamIds.map((steamId) => enqueue(queues.syncUser, { steamId })))

  const jobIds = steamIds.map((steamId) => registry['steam.sync-user'].jobId({ steamId }))
  const deadline = Date.now() + MAX_WAIT_MS
  let done = false
  while (!done && Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- polling
    await sleep(POLL_MS)
    // oxlint-disable-next-line no-await-in-loop -- polling
    const jobs = await Promise.all(jobIds.map((id) => queues.syncUser.getJob(id)))
    done = jobs.every((job) => !job)
  }

  const [found] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.userMatch)
    .where(
      and(
        eq(schema.userMatch.userId, userId),
        inArray(schema.userMatch.steamId, steamIds),
        gte(schema.userMatch.discoveredAt, startedAt),
      ),
    )

  return { newMatches: found?.count ?? 0, done }
}
