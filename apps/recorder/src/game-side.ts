import { join } from 'node:path'
import { RecorderGameEnv, loadEnv } from '@subtick/config'
import type { Logger } from '@subtick/logger'
import { createGame } from './cs2/game'
import { Cs2Recorder } from './cs2/recorder'
import { createHost, resolveLayout } from './layout'

export const loadGameEnv = () => loadEnv(RecorderGameEnv)

export type GameEnv = ReturnType<typeof loadGameEnv>

/** The game and the recorder driving it, as the worker and `smoke` use them. */
export const createGameSide = (env: GameEnv, log: Logger<unknown>) => {
  const layout = resolveLayout(env)
  const resolution = { width: env.RECORD_WIDTH, height: env.RECORD_HEIGHT }
  const game = createGame({
    host: createHost(layout, env.WINEPREFIX),
    cs2Dir: layout.cs2Dir,
    hlaeDir: layout.hlaeDir,
    netconPort: env.CS2_NETCON_PORT,
    configDir: layout.configDir,
    resolution,
    log: log.getSubLogger({ name: 'cs2' }),
  })
  const recorder = new Cs2Recorder({
    game,
    cs2Dir: layout.cs2Dir,
    takesDir: join(layout.configDir, 'takes'),
    mirvPov: env.HLAE_POV,
    fps: env.RECORD_FPS,
    log,
  })

  return { layout, resolution, game, recorder }
}
