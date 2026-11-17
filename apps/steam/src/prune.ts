import { and, eq, exists, inArray, isNotNull, lt, not, schema } from '@subtick/db'
import { keys } from '@subtick/storage'
import type { Context } from './context'

const DAY_MS = 24 * 3600_000

/**
 * Deletes demos stored longer than the retention, from matches the pipeline is done with. The row
 * drops its key first: a failed object delete leaves an orphan, never a key to a missing file.
 */
export const pruneDemos = async ({ db, demos, env, log }: Context) => {
  const { match, highlight } = schema
  const cutoff = new Date(Date.now() - env.DEMO_RETENTION_DAYS * DAY_MS)
  const queuedClips = db
    .select({ id: highlight.id })
    .from(highlight)
    .where(and(eq(highlight.matchId, match.id), eq(highlight.status, 'queued')))
  const pruned = await db
    .update(match)
    .set({ demoKey: null })
    .where(
      and(
        isNotNull(match.demoKey),
        lt(match.demoStoredAt, cutoff),
        inArray(match.status, ['ready', 'failed', 'expired']),
        not(exists(queuedClips)),
      ),
    )
    .returning({ id: match.id })
  if (!pruned.length) return

  const results = await Promise.allSettled(pruned.map(({ id }) => demos.delete(keys.demo(id))))
  const failed = results.filter((r) => r.status === 'rejected')
  for (const r of failed) log.warn({ error: String(r.reason) }, 'demo object delete failed')
  log.info({ demos: pruned.length, failed: failed.length, cutoff }, 'pruned stored demos')
}
