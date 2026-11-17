import { createDb, createSecretBox } from '@subtick/db'
import { createLogger } from '@subtick/logger'
import { createMailer } from '@subtick/mail'
import { createMatchEventPublisher, createQueue } from '@subtick/queue'
import { createSteamWebApi } from '@subtick/steam'
import { createS3Storage } from '@subtick/storage'
import { createAuth } from './auth'
import type { Env } from './env'
import { deleteImageObjects, userImageKeys } from './services/profile-images'

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

  const clips = createS3Storage({
    ...s3,
    bucket: env.S3_BUCKET_CLIPS,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
  })

  const mailer = createMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM })
  const log = createLogger('api')

  return {
    env,
    mailer,
    db,
    steamApi,
    log,
    secrets: await createSecretBox(env.SECRETS_KEY),
    // Recorders on other machines download demos through presigned URLs, like browsers do clips.
    demos: createS3Storage({
      ...s3,
      bucket: env.S3_BUCKET_DEMOS,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    }),
    clips,
    queues: {
      syncUser: createQueue('steam.sync-user', env.REDIS_URL),
      resolveMatch: createQueue('steam.resolve-match', env.REDIS_URL),
      download: createQueue('demo.download', env.REDIS_URL),
      parse: createQueue('demo.parse', env.REDIS_URL),
      recordClip: createQueue('clip.record', env.REDIS_URL),
    },
    publish: createMatchEventPublisher(env.REDIS_URL),
    auth: createAuth({
      env,
      db,
      steamApi,
      mailer,
      log,
      beforeDeleteUser: async (userId) =>
        deleteImageObjects(clips, await userImageKeys(db, userId)),
    }),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
