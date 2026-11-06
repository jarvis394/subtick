import { DatabaseEnv, RedisEnv, S3Env, WorkerEnv, loadEnv } from '@subtick/config'
import { and, createDb, eq, notCancelled, schema } from '@subtick/db'
import { isCancelled } from '@subtick/domain'
import { createLogger } from '@subtick/logger'
import {
  closeOnSignal,
  createMatchEventPublisher,
  createQueue,
  createWorker,
  enqueue,
  enqueueBulk,
} from '@subtick/queue'
import { createS3Storage, keys } from '@subtick/storage'
import { PARSER_VERSION, analyzeDemo } from './analyze'
import { markMatchFailed, persistAnalysis, refreshPlayerStats, staleMatchIds } from './persist'

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
const reanalyzeQueue = createQueue('demo.reanalyze', env.REDIS_URL)
const publish = createMatchEventPublisher(env.REDIS_URL)

const loadDemo = async (matchId: string) =>
  Buffer.from(await Bun.zstdDecompress(await demos.bytes(keys.demo(matchId))))

const worker = createWorker(
  'demo.parse',
  env.REDIS_URL,
  async (job) => {
    const { matchId } = job.data
    const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
    if (!row || isCancelled(row)) return

    await db
      .update(schema.match)
      .set({ status: 'parsing' })
      .where(and(eq(schema.match.id, matchId), notCancelled))
    await publish({ matchId, status: 'parsing' })

    const started = performance.now()
    const analysis = analyzeDemo(await loadDemo(matchId))
    // Parsing can't be interrupted; a cancel that came in meanwhile drops the result.
    const [now] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
    if (!now || isCancelled(now)) return void log.info({ matchId }, 'parse cancelled')
    const highlightIds = await persistAnalysis(db, matchId, analysis, PARSER_VERSION)

    if (highlightIds.length) await enqueue(recordQueue, { matchId, highlightIds })
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
    const { matchId } = job.data
    // Event handlers aren't awaited: a rejection here (e.g. Redis briefly gone) would kill the
    // process.
    await markMatchFailed(db, matchId, error.message)
      .then(() => publish({ matchId, status: 'failed' }))
      .catch((cause) => log.error({ matchId }, 'could not mark match failed', cause))
  }
})

// Matches from an older parser get fresh player stats, one at a time behind new parses.
const reanalyzer = createWorker(
  'demo.reanalyze',
  env.REDIS_URL,
  async (job) => {
    const { matchId, parserVersion } = job.data
    if (parserVersion !== PARSER_VERSION) return
    const [row] = await db.select().from(schema.match).where(eq(schema.match.id, matchId))
    if (!row || (row.parserVersion ?? 0) >= PARSER_VERSION) return
    if (row.status !== 'ready' && row.status !== 'recording') return

    const started = performance.now()
    await refreshPlayerStats(db, matchId, analyzeDemo(await loadDemo(matchId)), PARSER_VERSION)
    log.info({ matchId, ms: Math.round(performance.now() - started) }, 'reanalyzed')
  },
  { concurrency: 1, lockDuration: 120_000 },
)

reanalyzer.on('failed', (job, error) =>
  log.error({ matchId: job?.data.matchId, attempt: job?.attemptsMade }, 'reanalyze failed', error),
)

const stale = await staleMatchIds(db, PARSER_VERSION)

if (stale.length) {
  await enqueueBulk(
    reanalyzeQueue,
    stale.map((matchId) => ({ matchId, parserVersion: PARSER_VERSION })),
  )
  log.info({ matches: stale.length, version: PARSER_VERSION }, 'queued reanalysis')
}

closeOnSignal(worker, reanalyzer, recordQueue, reanalyzeQueue)
log.info({ version: PARSER_VERSION, concurrency: env.WORKER_CONCURRENCY }, 'parser worker started')
