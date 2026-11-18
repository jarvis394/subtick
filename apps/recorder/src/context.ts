import { RecorderEnv, RedisEnv, WorkerEnv, loadEnv } from '@subtick/config'
import { createLogger } from '@subtick/logger'
import { type ClipProgress, type MatchEvent, createMatchEventPublisher } from '@subtick/queue'
import { createSubtickApi } from './api'
import { createFleetLink, createStatus } from './fleet'
import { createGameSide } from './game-side'
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
  const { layout, resolution, game, recorder } = createGameSide(env, log)

  return {
    env,
    log,
    api,
    recorder,
    game,
    fleet,
    status: health,
    /** On while an admin keeps CS2 killed: a dead game then stops the job instead of restarting. */
    killSwitch: { on: false },
    layout,
    resolution,
    progress: (matchId: string, progress: MatchEvent['progress'], clip?: ClipProgress) =>
      publish({ matchId, status: 'recording', progress, clip }),
  }
}

export type Context = ReturnType<typeof createContext>
