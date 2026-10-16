import { createDb, createSecretBox } from '@subtick/db'
import { createLogger } from '@subtick/logger'
import { createQueue } from '@subtick/queue'
import { createSteamWebApi } from '@subtick/steam'
import { createS3Storage } from '@subtick/storage'
import { createAuth } from './auth'
import type { Env } from './env'

/** Everything route handlers depend on, built once at startup. */
export const createContext = async (env: Env) => {
  const db = createDb(env.DATABASE_URL)
  const steamApi = createSteamWebApi(env.STEAM_API_KEY)
  const s3 = {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  }

  return {
    env,
    db,
    steamApi,
    log: createLogger('api'),
    secrets: await createSecretBox(env.SECRETS_KEY),
    clips: createS3Storage({ ...s3, bucket: env.S3_BUCKET_CLIPS }),
    queues: {
      syncUser: createQueue('steam.sync-user', env.REDIS_URL),
      resolveMatch: createQueue('steam.resolve-match', env.REDIS_URL),
      recordClip: createQueue('clip.record', env.REDIS_URL),
    },
    auth: createAuth({ env, db, steamApi }),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
