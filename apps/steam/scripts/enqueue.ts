/**
 * Puts a match into the pipeline without a Steam account: `bun run enqueue <demo-url | share-code>... [--user <steamId64>]`.
 * A demo URL skips the Game Coordinator, but its match id comes from the file name, so prefer share codes.
 * `--user` links the match to the subtick user who owns that Steam account.
 */
import { parseArgs } from 'node:util'
import { DatabaseEnv, RedisEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import { decodeShareCode, isShareCode, demoIdFromUrl } from '@subtick/domain'
import { type QueueName, type TypedQueue, createQueue, enqueue, queues } from '@subtick/queue'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { user: { type: 'string' } },
  allowPositionals: true,
})

if (!positionals.length) {
  console.error('usage: bun run enqueue <demo-url | share-code>... [--user <steamId64>]')
  process.exit(1)
}

const env = loadEnv({ ...DatabaseEnv, ...RedisEnv })
const db = createDb(env.DATABASE_URL)
const resolveQueue = createQueue('steam.resolve-match', env.REDIS_URL)
const downloadQueue = createQueue('demo.download', env.REDIS_URL)

/** A finished job keeps its id for a while; drop it so the same match can be run again. */
const clearFinished = async <N extends QueueName>(queue: TypedQueue<N>, id: string) => {
  const job = await queue.getJob(id)
  if (job && ((await job.isCompleted()) || (await job.isFailed()))) await job.remove()
}

const owner = values.user
  ? (await db.select().from(schema.steamLink).where(eq(schema.steamLink.steamId, values.user)))[0]
  : undefined

if (values.user && !owner)
  throw new Error(`No subtick user has linked Steam account ${values.user}`)

await Promise.all(
  positionals.map(async (input) => {
    const shareCode = isShareCode(input) ? input : null
    const matchId = shareCode ? decodeShareCode(shareCode).matchId.toString() : demoIdFromUrl(input)
    if (!matchId) throw new Error(`Not a share code or a Valve demo URL: ${input}`)

    await db
      .insert(schema.match)
      .values({ id: matchId, shareCode, demoUrl: shareCode ? null : input })
      // A known match imported by URL gets the URL, so its demo can be (re)downloaded.
      .onConflictDoUpdate({
        target: schema.match.id,
        set: shareCode ? { shareCode } : { demoUrl: input },
      })
    if (owner)
      await db
        .insert(schema.userMatch)
        .values({ userId: owner.userId, matchId, steamId: owner.steamId })
        .onConflictDoNothing()

    if (shareCode) {
      await clearFinished(resolveQueue, queues['steam.resolve-match'].jobId({ shareCode }))
      await enqueue(resolveQueue, { shareCode })
    } else {
      await clearFinished(downloadQueue, queues['demo.download'].jobId({ matchId }))
      await enqueue(downloadQueue, { matchId })
    }
    console.log(`${matchId} → ${shareCode ? 'steam.resolve-match' : 'demo.download'}`)
  }),
)

await Promise.all([resolveQueue.close(), downloadQueue.close()])
process.exit(0)
