/* oxlint-disable no-await-in-loop -- a handful of matches, one at a time */
/**
 * Dev tool: (re-)records a match's highlights for its subtick players, e.g. after changing the
 * clip look. Clears a finished job with the same id first, so it always runs again.
 *   bun run enqueue <matchId>... [--only <highlightId>]
 */
import { parseArgs } from 'node:util'
import { DatabaseEnv, RedisEnv, loadEnv } from '@subtick/config'
import { and, createDb, eq, inArray, schema } from '@subtick/db'
import { createQueue, enqueue, queues } from '@subtick/queue'

const { highlight, userMatch, match } = schema
const env = loadEnv({ ...DatabaseEnv, ...RedisEnv })
const db = createDb(env.DATABASE_URL)
const queue = createQueue('clip.record', env.REDIS_URL)

const { values, positionals: matchIds } = parseArgs({
  args: Bun.argv.slice(2),
  options: { only: { type: 'string' } },
  allowPositionals: true,
})
if (!matchIds.length) {
  console.error('usage: bun run enqueue <matchId>... [--only <highlightId>]')
  process.exit(1)
}

for (const matchId of matchIds) {
  const rows = await db
    .select({ id: highlight.id })
    .from(highlight)
    .innerJoin(
      userMatch,
      and(eq(userMatch.matchId, highlight.matchId), eq(userMatch.steamId, highlight.steamId)),
    )
    .where(eq(highlight.matchId, matchId))
  const highlightIds = rows.map((r) => r.id).filter((id) => !values.only || id === values.only)
  if (!highlightIds.length) {
    console.log(`${matchId}: no highlights of subtick players`)
    continue
  }
  await db.update(highlight).set({ status: 'queued' }).where(inArray(highlight.id, highlightIds))
  await db.update(match).set({ status: 'recording', error: null }).where(eq(match.id, matchId))
  const payload = { matchId, highlightIds }
  const existing = await queue.getJob(queues['clip.record'].jobId(payload))
  if (existing && ((await existing.isCompleted()) || (await existing.isFailed())))
    await existing.remove()
  await enqueue(queue, payload)
  console.log(`${matchId}: ${highlightIds.length} highlights → clip.record`)
}
await queue.close()
process.exit(0)
