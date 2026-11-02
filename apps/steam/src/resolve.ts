import { eq, schema } from '@subtick/db'
import { decodeShareCode, isCancelled } from '@subtick/domain'
import { enqueue, type TypedJob } from '@subtick/queue'
import type { Context } from './context'
import type { GameCoordinator } from './gc'
import { friendParties } from './parties'

/** Whether someone cancelled the match since its job started. */
export const cancelled = async ({ db }: Pick<Context, 'db'>, matchId: string) => {
  const [row] = await db
    .select({ status: schema.match.status, error: schema.match.error })
    .from(schema.match)
    .where(eq(schema.match.id, matchId))

  return !row || isCancelled(row)
}

/**
 * Asks the Game Coordinator where a match's demo is. Matches that already have a demo URL (or a
 * stored demo) skip the GC entirely, which is what keeps shared matches from being fetched twice.
 */
export const resolveMatch = async (
  ctx: Context,
  gc: GameCoordinator,
  job: TypedJob<'steam.resolve-match'>,
) => {
  const { db, queues, setStatus, steamApi, log } = ctx
  const { shareCode } = job.data
  const matchId = decodeShareCode(shareCode).matchId.toString()
  const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
  if (!row || row.demoKey || isCancelled(row)) return
  if (row.demoUrl) return void (await enqueue(queues.download, { matchId }))

  await setStatus(matchId, 'resolving')
  const resolved = await gc.resolve(shareCode, matchId)
  const parties = Object.keys(resolved.parties).length
    ? resolved.parties
    : await friendParties(steamApi, resolved.players).catch((error) => {
        log.warn({ matchId, error }, 'could not read friend lists for parties')

        return {}
      })
  await db
    .update(schema.match)
    .set({
      demoUrl: resolved.demoUrl,
      playedAt: resolved.playedAt,
      scoreStartedCt: resolved.score?.startedCt ?? null,
      scoreStartedT: resolved.score?.startedT ?? null,
      parties: Object.keys(parties).length ? parties : null,
    })
    .where(eq(schema.match.id, matchId))

  if (!resolved.demoUrl) {
    await setStatus(matchId, 'expired', 'Valve no longer has this demo')
    log.info({ matchId }, 'demo expired before it was resolved')

    return
  }
  if (await cancelled(ctx, matchId)) return
  await enqueue(queues.download, { matchId })
  log.info({ matchId, parties: Object.keys(parties).length }, 'match resolved')
}
