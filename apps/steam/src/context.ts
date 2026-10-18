import { join } from 'node:path'
import {
  DatabaseEnv,
  RedisEnv,
  S3Env,
  SecretsEnv,
  SteamBotEnv,
  SteamEnv,
  WorkerEnv,
  loadEnv,
} from '@subtick/config'
import { and, createDb, createSecretBox, eq, notCancelled, schema } from '@subtick/db'
import type { MatchStatus } from '@subtick/domain'
import { createLogger } from '@subtick/logger'
import { createMatchEventPublisher, createQueue } from '@subtick/queue'
import { createSteamWebApi } from '@subtick/steam'
import { createS3Storage } from '@subtick/storage'
import { createGameCoordinator } from './gc'

/** Everything the steam worker's jobs depend on, built once at startup. */
export const createContext = async () => {
  const env = loadEnv({
    ...DatabaseEnv,
    ...RedisEnv,
    ...S3Env,
    ...SteamEnv,
    ...SteamBotEnv,
    ...SecretsEnv,
    ...WorkerEnv,
  })
  const log = createLogger('steam')
  const db = createDb(env.DATABASE_URL)
  const publish = createMatchEventPublisher(env.REDIS_URL)

  const gc =
    env.STEAM_BOT_USERNAME && env.STEAM_BOT_PASSWORD
      ? createGameCoordinator(
          {
            username: env.STEAM_BOT_USERNAME,
            password: env.STEAM_BOT_PASSWORD,
            sharedSecret: env.STEAM_BOT_SHARED_SECRET,
            guardCode: env.STEAM_BOT_GUARD_CODE,
          },
          { dataDir: join(env.SCRATCH_DIR, 'steam-bot'), log: log.getSubLogger({ name: 'gc' }) },
        )
      : null

  /** Moves a match to a pipeline status and tells subscribed browsers. */
  const setStatus = async (matchId: string, status: MatchStatus, error: string | null = null) => {
    const updated = await db
      .update(schema.match)
      .set({ status, error })
      .where(and(eq(schema.match.id, matchId), notCancelled))
      .returning({ id: schema.match.id })
    if (updated.length) await publish({ matchId, status })
  }

  return {
    env,
    log,
    db,
    gc,
    setStatus,
    publish,
    steamApi: createSteamWebApi(env.STEAM_API_KEY),
    secrets: await createSecretBox(env.SECRETS_KEY),
    demos: createS3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      bucket: env.S3_BUCKET_DEMOS,
    }),
    queues: {
      schedule: createQueue('steam.schedule', env.REDIS_URL),
      syncUser: createQueue('steam.sync-user', env.REDIS_URL),
      resolveMatch: createQueue('steam.resolve-match', env.REDIS_URL),
      download: createQueue('demo.download', env.REDIS_URL),
      parse: createQueue('demo.parse', env.REDIS_URL),
    },
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
