import { join } from 'node:path'
import { RecorderEnv, RedisEnv, WorkerEnv, loadEnv } from '@subtick/config'
import { createLogger } from '@subtick/logger'
import { type ClipProgress, type MatchEvent, createMatchEventPublisher } from '@subtick/queue'
import { createSubtickApi } from './api'
import { createGame } from './cs2/game'
import { Cs2Recorder } from './cs2/recorder'
import { createWindowsHost } from './cs2/windows'
import { createWineHost } from './cs2/wine'
import { createFleetLink, createStatus } from './fleet'
import { RECORDER_VERSION } from './record'

/** Everything the recorder's jobs depend on, built once at startup. */
export const createContext = () => {
  const env = loadEnv({ ...RedisEnv, ...RecorderEnv, ...WorkerEnv })
  const log = createLogger('recorder')
  const publish = createMatchEventPublisher(env.REDIS_URL)
  const api = createSubtickApi({ url: env.SUBTICK_URL, token: env.RECORDER_TOKEN })
  const health = createStatus()
  const fleet = createFleetLink({
    api,
    version: `v${RECORDER_VERSION}`,
    status: health,
    log: log.getSubLogger({ name: 'fleet' }),
  })

  const windows = env.GAME_HOST === 'windows'
  /** Holds HLAE and our config: the prefix's drive C under Wine, a folder on a Windows drive in WSL. */
  const root = windows ? env.WINDOWS_DIR : join(env.WINEPREFIX, 'drive_c')
  const hlaeDir = join(root, 'hlae')
  /** HLAE's `USRLOCALCSGO`: our cfg folder, kept apart from the game's own settings. */
  const configDir = join(root, 'subtick')
  const game = createGame({
    host: windows ? createWindowsHost([root, env.CS2_DIR]) : createWineHost(env.WINEPREFIX),
    cs2Dir: env.CS2_DIR,
    hlaeDir,
    netconPort: env.CS2_NETCON_PORT,
    configDir,
    log: log.getSubLogger({ name: 'cs2' }),
  })
  const recorder = new Cs2Recorder({
    game,
    cs2Dir: env.CS2_DIR,
    takesDir: join(configDir, 'takes'),
    mirvPov: env.HLAE_POV,
    log,
  })

  return {
    env,
    log,
    api,
    recorder,
    game,
    fleet,
    status: health,
    configDir,
    hlaeDir,
    progress: (matchId: string, progress: MatchEvent['progress'], clip?: ClipProgress) =>
      publish({ matchId, status: 'recording', progress, clip }),
  }
}

export type Context = ReturnType<typeof createContext>
