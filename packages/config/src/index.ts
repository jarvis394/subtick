import { join } from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'

// Apps run from their own directory under turbo, so the repo-root .env is loaded explicitly.
// Variables already set in the environment win.
config({ path: join(import.meta.dir, '../../../.env'), quiet: true })

/**
 * Validates `env` against a shape: applies defaults, coerces numbers and throws a readable error
 * listing every invalid variable. Call once at process start.
 *
 * Apps compose fragments: `loadEnv({ ...DatabaseEnv, ...RedisEnv })`.
 */
export const loadEnv = <T extends z.ZodRawShape>(
  shape: T,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const result = z.object(shape).safeParse(env)
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  return result.data
}

export const LogEnv = {
  LOG_LEVEL: z.enum(['SILLY', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).default('INFO'),
  /** `pretty` for local dev, `json` (one object per line) for log collectors. */
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
}
export const DatabaseEnv = { DATABASE_URL: z.url() }
export const RedisEnv = { REDIS_URL: z.url() }
export const S3Env = {
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_DEMOS: z.string().default('demos'),
  S3_BUCKET_CLIPS: z.string().default('clips'),
}
export const WorkerEnv = {
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  SCRATCH_DIR: z.string().default('/tmp/subtick'),
}
