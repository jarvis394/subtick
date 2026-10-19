import {
  CANCELLED_ERROR,
  type MatchStatus,
  PROCESSING_STATUSES,
  decodeShareCode,
  isProcessingStatus,
} from '@subtick/domain'
import { type SQL, and, eq, inArray, isNull, or, schema } from '@subtick/db'
import { PENDING_STATES, enqueue, requeue } from '@subtick/queue'
import type { Context } from '../context'

type Ctx = Pick<Context, 'db' | 'queues' | 'publish'>

/**
 * Registers a match for a user. The match row is shared: if anyone already imported it, the user
 * is only linked to it and nothing is resolved or downloaded again.
 */
export const importShareCode = async (
  { db, queues }: Pick<Context, 'db' | 'queues'>,
  { userId, steamId, shareCode }: { userId: string; steamId: string; shareCode: string },
) => {
  const matchId = decodeShareCode(shareCode).matchId.toString()

  const [created] = await db
    .insert(schema.match)
    .values({ id: matchId, shareCode })
    .onConflictDoNothing()
    .returning({ id: schema.match.id })
  await db.insert(schema.userMatch).values({ userId, matchId, steamId }).onConflictDoNothing()

  if (created) await enqueue(queues.resolveMatch, { shareCode, userId, steamId })
  return { matchId, isNew: Boolean(created) }
}

/**
 * Runs a failed or expired match through the pipeline again, from the first stage it has no
 * result for: resolving, downloading, parsing, or recording the clips that failed. Any other
 * status is returned as it is.
 */
export const retryMatch = async (
  { db, queues, publish }: Pick<Context, 'db' | 'queues' | 'publish'>,
  matchId: string,
) => {
  const { match, highlight } = schema
  // `returning` gives the row as updated; the status it had is the one it goes back to if there
  // is nothing to run.
  const [before] = await db
    .select({ status: match.status })
    .from(match)
    .where(eq(match.id, matchId))
  if (!before) return null
  if (before.status !== 'failed' && before.status !== 'expired') return before.status
  const [row] = await db
    .update(match)
    .set({ status: 'queued', error: null })
    .where(and(eq(match.id, matchId), inArray(match.status, ['failed', 'expired'])))
    .returning()
  if (!row) return before.status

  let status: MatchStatus = 'queued'
  if (!row.demoUrl && row.shareCode)
    await requeue(queues.resolveMatch, { shareCode: row.shareCode })
  else if (!row.demoUrl) status = before.status
  else if (!row.demoKey) await requeue(queues.download, { matchId })
  else if (!row.parserVersion) await requeue(queues.parse, { matchId })
  else {
    const failed = await db
      .update(highlight)
      .set({ status: 'queued', error: null })
      .where(and(eq(highlight.matchId, matchId), eq(highlight.status, 'failed')))
      .returning({ id: highlight.id })
    if (failed.length)
      await requeue(queues.recordClip, { matchId, highlightIds: failed.map((h) => h.id) })
    // Parsed, and nothing left to record: the match only needs its terminal status back.
    else status = 'ready'
  }
  if (status !== 'queued') await db.update(match).set({ status }).where(eq(match.id, matchId))
  await publish({ matchId, status })
  return status
}

/** The pipeline queues a match's own work waits in, in stage order. */
const matchQueues = ({ queues }: Pick<Context, 'queues'>) =>
  [queues.resolveMatch, queues.download, queues.parse, queues.recordClip] as const

/** Which match a pipeline job works on. */
export const jobMatchId = (data: { matchId?: string; shareCode?: string }) =>
  data.matchId ?? (data.shareCode ? decodeShareCode(data.shareCode).matchId.toString() : null)

/**
 * Removes a match's jobs that haven't started. A running job is locked by its worker and can't be
 * removed; workers look for the cancel between steps instead. `keep` spares record jobs that still
 * have clips to record.
 */
const removePendingJobs = async (
  ctx: Pick<Context, 'queues'>,
  matchId: string,
  keep: (data: { highlightIds?: string[] }) => boolean = () => false,
) => {
  const lists = await Promise.all(matchQueues(ctx).map((q) => q.getJobs([...PENDING_STATES])))
  const jobs = lists.flat().filter((job) => {
    const data = job.data as { matchId?: string; shareCode?: string; highlightIds?: string[] }
    return jobMatchId(data) === matchId && !keep(data)
  })
  // A job a worker picked up meanwhile is locked; its worker sees the cancel instead.
  await Promise.allSettled(jobs.map((job) => job.remove()))
}

/** Who is asking: admins may stop anything; players only their own requests and matches. */
export interface Actor {
  id: string
  isAdmin: boolean
}

export const actorOf = (user: { id: string; role?: string | null }): Actor => ({
  id: user.id,
  isAdmin: user.role === 'admin',
})

/** Whether `actor` played (imported) the match. */
export const ownsMatch = async ({ db }: Pick<Context, 'db'>, actor: Actor, matchId: string) => {
  const [own] = await db
    .select({ matchId: schema.userMatch.matchId })
    .from(schema.userMatch)
    .where(and(eq(schema.userMatch.matchId, matchId), eq(schema.userMatch.userId, actor.id)))
  return Boolean(own)
}

/**
 * Which queued clips `actor` may take off the queue: their own requests, and (for players of the
 * match) clips subtick queued on its own. Someone else's request is theirs to cancel.
 */
const cancellable = (actor: Actor, owns: boolean) => {
  const { highlight } = schema
  if (actor.isAdmin) return undefined
  const own = eq(highlight.requestedBy, actor.id)
  return owns ? or(own, isNull(highlight.requestedBy)) : own
}

/**
 * Takes clips off the recording queue (back to candidates, recordable later from Create
 * highlights), drops the jobs that have nothing left to record, and makes a match that was only
 * recording ready once nothing of it is queued.
 */
const dequeueClips = async (ctx: Ctx, matchId: string, which: SQL | undefined) => {
  const { db, publish } = ctx
  const { match, highlight } = schema
  const dropped = await db
    .update(highlight)
    .set({ status: 'candidate', requestedBy: null })
    .where(and(eq(highlight.matchId, matchId), eq(highlight.status, 'queued'), which))
    .returning({ id: highlight.id })

  const queued = await db
    .select({ id: highlight.id })
    .from(highlight)
    .where(and(eq(highlight.matchId, matchId), eq(highlight.status, 'queued')))
  const stillQueued = new Set(queued.map((h) => h.id))
  // Batches with other clips still to record stay; the recorder skips the dropped ones.
  await removePendingJobs(ctx, matchId, (data) =>
    (data.highlightIds ?? []).some((id) => stillQueued.has(id)),
  )
  if (!stillQueued.size) {
    const [ready] = await db
      .update(match)
      .set({ status: 'ready' })
      .where(and(eq(match.id, matchId), eq(match.status, 'recording')))
      .returning({ id: match.id })
    if (ready) await publish({ matchId, status: 'ready' })
  }
  return dropped.length
}

/**
 * Stops what `actor` may stop of a match. Its earlier stages (finding, downloading, analyzing the
 * demo) are for its players and admins: stopped there, the match is cancelled, and Retry resumes
 * it. Queued clips go back to being candidates, limited to the ones `actor` may cancel; when none
 * is left, a match that was recording is ready.
 */
export const cancelMatch = async (ctx: Ctx, matchId: string, actor: Actor) => {
  const { db, publish } = ctx
  const { match } = schema
  const [row] = await db.select().from(match).where(eq(match.id, matchId))
  if (!row) return null
  const owns = actor.isAdmin || (await ownsMatch(ctx, actor, matchId))

  // Not analyzed yet: the stage itself is what's stopped (no clips exist yet).
  if (!row.parserVersion && isProcessingStatus(row.status)) {
    if (!owns) return 'forbidden' as const
    const [updated] = await db
      .update(match)
      .set({ status: 'failed', error: CANCELLED_ERROR })
      .where(and(eq(match.id, matchId), inArray(match.status, PROCESSING_STATUSES)))
      .returning({ id: match.id })
    await removePendingJobs(ctx, matchId)
    if (updated) await publish({ matchId, status: 'failed' })
    return updated ? ('failed' as const) : row.status
  }

  const dropped = await dequeueClips(ctx, matchId, cancellable(actor, owns))
  if (!dropped && !owns) return 'forbidden' as const
  // A re-run (status `queued` after Retry) with nothing left to record is done.
  if (row.status === 'queued') {
    const [ready] = await db
      .update(match)
      .set({ status: 'ready' })
      .where(and(eq(match.id, matchId), eq(match.status, 'queued')))
      .returning({ id: match.id })
    if (ready) await publish({ matchId, status: 'ready' })
  }
  const [after] = await db.select({ status: match.status }).from(match).where(eq(match.id, matchId))
  return after?.status ?? row.status
}

/** Takes one queued clip off the recording queue, if `actor` may: see `cancellable`. */
export const cancelHighlight = async (ctx: Ctx, highlightId: string, actor: Actor) => {
  const { db } = ctx
  const { highlight } = schema
  const [row] = await db
    .select({ matchId: highlight.matchId, status: highlight.status })
    .from(highlight)
    .where(eq(highlight.id, highlightId))
  if (!row) return null
  if (row.status !== 'queued') return row.status
  const owns = actor.isAdmin || (await ownsMatch(ctx, actor, row.matchId))
  const dropped = await dequeueClips(
    ctx,
    row.matchId,
    and(eq(highlight.id, highlightId), cancellable(actor, owns)),
  )
  return dropped ? ('candidate' as const) : ('forbidden' as const)
}
