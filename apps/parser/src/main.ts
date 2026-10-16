import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseEnv, RedisEnv, S3Env, WorkerEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import { createLogger } from '@subtick/logger'
import {
  closeOnSignal,
  createMatchEventPublisher,
  createQueue,
  createWorker,
  enqueue,
} from '@subtick/queue'
import { createS3Storage, keys } from '@subtick/storage'
import { PARSER_VERSION, analyzeDemo } from './analyze'
import { markMatchFailed, persistAnalysis } from './persist'

const env = loadEnv({ ...DatabaseEnv, ...RedisEnv, ...S3Env, ...WorkerEnv })
const log = createLogger('parser')

const db = createDb(env.DATABASE_URL)
const demos = createS3Storage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET_DEMOS,
})
const recordQueue = createQueue('clip.record', env.REDIS_URL)
const publish = createMatchEventPublisher(env.REDIS_URL)

const loadDemo = async (matchId: string) => {
  const dir = join(env.SCRATCH_DIR, 'parser')
  await mkdir(dir, { recursive: true })
  const path = join(dir, keys.demo(matchId))
  try {
    await demos.download(keys.demo(matchId), path)
    return Buffer.from(await Bun.zstdDecompress(await Bun.file(path).bytes()))
  } finally {
    await rm(path, { force: true })
  }
}

const worker = createWorker(
  'demo.parse',
  env.REDIS_URL,
  async (job) => {
    const { matchId } = job.data
    const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
    if (!row) return

    await db.update(schema.match).set({ status: 'parsing' }).where(eq(schema.match.id, matchId))
    await publish({ matchId, status: 'parsing' })

    const started = performance.now()
    const analysis = analyzeDemo(await loadDemo(matchId))
    const highlightIds = await persistAnalysis(db, matchId, analysis, PARSER_VERSION)

    if (highlightIds.length) await enqueue(recordQueue, { matchId, highlightIds })
    else await db.update(schema.match).set({ status: 'ready' }).where(eq(schema.match.id, matchId))
    await publish({ matchId, status: highlightIds.length ? 'recording' : 'ready' })

    log.info(
      {
        matchId,
        jobId: job.id,
        ms: Math.round(performance.now() - started),
        highlights: analysis.highlights.length,
        recording: highlightIds.length,
      },
      'parsed',
    )
  },
  // Parsing is synchronous native work; one demo at a time per process keeps memory flat.
  { concurrency: env.WORKER_CONCURRENCY, lockDuration: 120_000 },
)

worker.on('failed', async (job, error) => {
  log.error(
    { matchId: job?.data.matchId, jobId: job?.id, attempt: job?.attemptsMade },
    'parse failed',
    error,
  )
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await markMatchFailed(db, job.data.matchId, error.message)
    await publish({ matchId: job.data.matchId, status: 'failed' })
  }
})

closeOnSignal(worker, recordQueue)
log.info({ version: PARSER_VERSION, concurrency: env.WORKER_CONCURRENCY }, 'parser worker started')
