import { type MatchStatus, decodeShareCode } from '@subtick/domain'
import { and, eq, inArray, schema } from '@subtick/db'
import { enqueue, requeue } from '@subtick/queue'
import type { Context } from '../context'

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
      .set({ status: 'queued' })
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
