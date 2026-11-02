import { and, desc, eq, inArray, isNotNull, lte, schema } from '@subtick/db'
import { enqueueBulk, type TypedJob } from '@subtick/queue'
import type { Context } from './context'
import { registerShareCode } from './matches'

const { steamLink, userMatch } = schema

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/**
 * How often a caught-up account is polled, by how long ago its latest match turned up: fast while
 * the player is mid-session, backing off the longer they stay away. Valve's Web API allows ~100k
 * calls a day, and an idle poll costs one, so 5 minutes for everyone would cap out near 340 accounts.
 */
const FALLOFF: { quietFor: number; every: number }[] = [
  { quietFor: 2 * HOUR, every: 5 * MINUTE },
  { quietFor: 24 * HOUR, every: 10 * MINUTE },
  { quietFor: 3 * 24 * HOUR, every: 15 * MINUTE },
]

const IDLE_INTERVAL_MS = HOUR
/** A failed sync is retried at the fastest rate. */
const RETRY_INTERVAL_MS = 5 * MINUTE
/** Codes walked per job; a long backlog continues on the next scheduler tick. */
const MAX_CODES_PER_JOB = 25
/** Links picked per scheduler tick. */
const SCHEDULE_BATCH = 200

/** Scheduler tick: queues a sync for every linked account that is due. */
export const scheduleSyncs = async ({ db, queues, log }: Context) => {
  const due = await db
    .select({ steamId: steamLink.steamId })
    .from(steamLink)
    .where(
      and(
        isNotNull(steamLink.authCode),
        isNotNull(steamLink.lastShareCode),
        inArray(steamLink.syncState, ['idle', 'error']),
        lte(steamLink.nextSyncAt, new Date()),
      ),
    )
    .orderBy(steamLink.nextSyncAt)
    .limit(SCHEDULE_BATCH)
  if (!due.length) return
  // Job ids dedupe accounts whose previous sync is still queued.
  await enqueueBulk(queues.syncUser, due)
  log.debug({ count: due.length }, 'syncs scheduled')
}

/** Walks one account's match history from its last known share code to the newest one. */
export const syncUser = async (ctx: Context, job: TypedJob<'steam.sync-user'>) => {
  const { db, steamApi, secrets, log } = ctx
  const { steamId } = job.data
  const [link] = await db.select().from(steamLink).where(eq(steamLink.steamId, steamId))
  if (!link?.authCode || !link.lastShareCode) return

  const update = (values: Partial<typeof steamLink.$inferInsert>) =>
    db.update(steamLink).set(values).where(eq(steamLink.steamId, steamId))

  await update({ syncState: 'syncing' })
  const authCode = await secrets.decrypt(link.authCode)
  let knownCode = link.lastShareCode
  let found = 0

  try {
    for (; found < MAX_CODES_PER_JOB; found++) {
      // oxlint-disable-next-line no-await-in-loop -- each code is the key for the next request
      const next = await steamApi.getNextShareCode({ steamId, authCode, knownCode })
      if (next.status === 'none') break
      if (next.status !== 'next') {
        // The user revoked the code or it never matched this account: only they can fix it.
        // oxlint-disable-next-line no-await-in-loop -- leaves the loop right after
        await update({ syncState: 'needs_auth', lastError: next.status, nextSyncAt: null })
        log.warn({ steamId, reason: next.status }, 'sync needs a new auth code')

        return
      }
      // oxlint-disable-next-line no-await-in-loop -- matches are registered in history order
      await registerShareCode(ctx, { userId: link.userId, steamId, shareCode: next.shareCode })
      // Advance one code at a time so a crash mid-walk resumes where it stopped.
      knownCode = next.shareCode
      // oxlint-disable-next-line no-await-in-loop -- see above
      await update({ lastShareCode: knownCode })
    }
  } catch (error) {
    await update({
      syncState: 'error',
      lastError: error instanceof Error ? error.message : String(error),
      nextSyncAt: new Date(Date.now() + RETRY_INTERVAL_MS),
    })
    throw error
  }

  const backlog = found === MAX_CODES_PER_JOB
  await update({
    syncState: 'idle',
    lastError: null,
    lastSyncedAt: new Date(),
    nextSyncAt: new Date(Date.now() + (backlog ? 0 : await nextInterval(ctx, steamId))),
  })
  if (found) log.info({ steamId, found, backlog }, 'new matches found')
}

/** The poll interval for an account, per {@link FALLOFF}. */
const nextInterval = async ({ db }: Context, steamId: string) => {
  const [latest] = await db
    .select({ at: userMatch.discoveredAt })
    .from(userMatch)
    .where(eq(userMatch.steamId, steamId))
    .orderBy(desc(userMatch.discoveredAt))
    .limit(1)
  if (!latest) return IDLE_INTERVAL_MS
  const quietFor = Date.now() - latest.at.getTime()

  return FALLOFF.find((step) => quietFor < step.quietFor)?.every ?? IDLE_INTERVAL_MS
}
