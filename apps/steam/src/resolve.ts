import { eq, schema } from '@subtick/db'
import { decodeShareCode } from '@subtick/domain'
import { enqueue, type TypedJob } from '@subtick/queue'
import type { Context } from './context'
import type { GameCoordinator } from './gc'

/**
 * Asks the Game Coordinator where a match's demo is. Matches that already have a demo URL (or a
 * stored demo) skip the GC entirely, which is what keeps shared matches from being fetched twice.
 */
export const resolveMatch = async (
  ctx: Context,
  gc: GameCoordinator,
  job: TypedJob<'steam.resolve-match'>,
) => {
  const { db, queues, setStatus, log } = ctx
  const { shareCode } = job.data
  const matchId = decodeShareCode(shareCode).matchId.toString()
  const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
  if (!row || row.demoKey) return
  if (row.demoUrl) return void (await enqueue(queues.download, { matchId }))

  await setStatus(matchId, 'resolving')
  const resolved = await gc.resolve(shareCode, matchId)
  await db
    .update(schema.match)
    .set({
      demoUrl: resolved.demoUrl,
      playedAt: resolved.playedAt,
      parties: Object.keys(resolved.parties).length ? resolved.parties : null,
    })
    .where(eq(schema.match.id, matchId))

  if (!resolved.demoUrl) {
    await setStatus(matchId, 'expired', 'Valve no longer has this demo')
    log.info({ matchId }, 'demo expired before it was resolved')
    return
  }
  await enqueue(queues.download, { matchId })
  log.info({ matchId, parties: Object.keys(resolved.parties).length }, 'match resolved')
}
