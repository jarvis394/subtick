import { join } from 'node:path'
import { DatabaseEnv, RecorderEnv, RedisEnv, S3Env, WorkerEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import type { MatchStatus } from '@subtick/domain'
import { createLogger } from '@subtick/logger'
import { type MatchEvent, createMatchEventPublisher } from '@subtick/queue'
import { createS3Storage } from '@subtick/storage'
import { Cs2Recorder } from './cs2/recorder'
import { createWineGame } from './cs2/wine'

/** Everything the recorder's jobs depend on, built once at startup. */
export const createContext = () => {
  const env = loadEnv({ ...DatabaseEnv, ...RedisEnv, ...S3Env, ...RecorderEnv, ...WorkerEnv })
  const log = createLogger('recorder')
  const db = createDb(env.DATABASE_URL)
  const publish = createMatchEventPublisher(env.REDIS_URL)
  const s3 = {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  }

  /** HLAE's `USRLOCALCSGO`: our cfg folder, kept apart from the signed-in account's settings. */
  const configDir = join(env.WINEPREFIX, 'drive_c/subtick')
  const recorder = new Cs2Recorder({
    game: createWineGame({
      cs2Dir: env.CS2_DIR,
      prefix: env.WINEPREFIX,
      netconPort: env.CS2_NETCON_PORT,
      configDir,
      steamCredentials:
        env.STEAM_USERNAME && env.STEAM_PASSWORD
          ? {
              username: env.STEAM_USERNAME,
              password: env.STEAM_PASSWORD,
              sharedSecret: env.STEAM_SHARED_SECRET,
            }
          : undefined,
      log: log.getSubLogger({ name: 'cs2' }),
    }),
    cs2Dir: env.CS2_DIR,
    prefix: env.WINEPREFIX,
    takesDir: join(configDir, 'takes'),
    log,
  })

  /** Moves a match to a pipeline status and tells subscribed browsers. */
  const setStatus = async (matchId: string, status: MatchStatus, error: string | null = null) => {
    await db.update(schema.match).set({ status, error }).where(eq(schema.match.id, matchId))
    await publish({ matchId, status })
  }

  return {
    env,
    log,
    db,
    recorder,
    configDir,
    setStatus,
    progress: (matchId: string, progress: MatchEvent['progress']) =>
      publish({ matchId, status: 'recording', progress }),
    demos: createS3Storage({ ...s3, bucket: env.S3_BUCKET_DEMOS }),
    clips: createS3Storage({ ...s3, bucket: env.S3_BUCKET_CLIPS }),
  }
}

export type Context = ReturnType<typeof createContext>
