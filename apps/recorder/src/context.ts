import { join } from 'node:path'
import { DatabaseEnv, RecorderEnv, RedisEnv, S3Env, WorkerEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import type { MatchStatus } from '@subtick/domain'
import { createLogger } from '@subtick/logger'
import { type MatchEvent, createMatchEventPublisher } from '@subtick/queue'
import { createS3Storage } from '@subtick/storage'
import { Cs2Recorder } from './cs2/recorder'
import { type SteamAccountSource, createWineGame } from './cs2/wine'
import { createFleetLink, createStatus } from './fleet'
import { RECORDER_VERSION } from './record'

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

  if (Boolean(env.SUBTICK_URL) !== Boolean(env.RECORDER_TOKEN))
    throw new Error('SUBTICK_URL and RECORDER_TOKEN go together: set both to join the fleet')

  const health = createStatus(env.STEAM_MODE)
  const fleet =
    env.SUBTICK_URL && env.RECORDER_TOKEN
      ? createFleetLink({
          url: env.SUBTICK_URL,
          token: env.RECORDER_TOKEN,
          version: `v${RECORDER_VERSION}`,
          status: health,
          log: log.getSubLogger({ name: 'fleet' }),
        })
      : null
  const envAccount: SteamAccountSource = {
    credentials: async () =>
      env.STEAM_USERNAME && env.STEAM_PASSWORD
        ? {
            username: env.STEAM_USERNAME,
            password: env.STEAM_PASSWORD,
            sharedSecret: env.STEAM_SHARED_SECRET,
          }
        : undefined,
    takeGuardCode: async () => null,
  }

  /** HLAE's `USRLOCALCSGO`: our cfg folder, kept apart from the signed-in account's settings. */
  const configDir = join(env.WINEPREFIX, 'drive_c/subtick')
  const game = createWineGame({
    cs2Dir: env.CS2_DIR,
    prefix: env.WINEPREFIX,
    netconPort: env.CS2_NETCON_PORT,
    configDir,
    steamAccount: fleet?.steamAccount ?? envAccount,
    steam: env.STEAM_MODE,
    log: log.getSubLogger({ name: 'cs2' }),
  })
  const recorder = new Cs2Recorder({
    game,
    cs2Dir: env.CS2_DIR,
    prefix: env.WINEPREFIX,
    takesDir: join(configDir, 'takes'),
    mirvPov: env.HLAE_POV,
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
    game,
    fleet,
    status: health,
    configDir,
    setStatus,
    progress: (matchId: string, progress: MatchEvent['progress']) =>
      publish({ matchId, status: 'recording', progress }),
    demos: createS3Storage({ ...s3, bucket: env.S3_BUCKET_DEMOS }),
    clips: createS3Storage({ ...s3, bucket: env.S3_BUCKET_CLIPS }),
  }
}

export type Context = ReturnType<typeof createContext>
