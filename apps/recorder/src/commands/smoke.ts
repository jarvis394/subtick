import { createLogger } from '@subtick/logger'
import { installConfig } from '../cs2/config'
import { createGameSide, loadGameEnv } from '../game-side'
import { localPath } from '../platform'

const second = 64

/**
 * One clip end to end without subtick or the queue: record a two-segment clip, restart CS2, record
 * again. Stop the worker first; they share the game. Captures stay in the takes folder (`smoke*`).
 */
export const smoke = async (demo: string, tick = '20000', playerName = '') => {
  const startTick = Number(tick)
  const demoPath = localPath(demo)
  const log = createLogger('smoke')
  const env = loadGameEnv()
  const { layout, resolution, recorder } = createGameSide(env, log)

  const time = async <T>(label: string, task: () => Promise<T>) => {
    const start = performance.now()
    const result = await task()
    log.info({ seconds: +((performance.now() - start) / 1000).toFixed(1) }, label)

    return result
  }

  await installConfig(layout.configDir, resolution)
  try {
    log.info({ pov: env.HLAE_POV, startTick, playerName }, 'smoke test')
    await time('demo loaded', () => recorder.prepare({ matchId: 'smoke', demoPath, map: '' }))
    // Two segments with a cut between them, like a highlight whose kills are far apart.
    const clip = await time('two-segment clip recorded', () =>
      recorder.record({
        highlightId: 'smoke',
        playerName,
        segments: [
          { startTick, endTick: startTick + 5 * second },
          { startTick: startTick + 15 * second, endTick: startTick + 20 * second },
        ],
      }),
    )
    log.info(clip, 'capture')
    // What a failed clip does: restart the game, load the demo again, keep recording.
    await recorder.reset()
    await time('demo loaded after a restart', () =>
      recorder.prepare({ matchId: 'smoke', demoPath, map: '' }),
    )
    const again = await time('clip recorded after a restart', () =>
      recorder.record({
        highlightId: 'smoke-restart',
        playerName,
        segments: [{ startTick, endTick: startTick + 5 * second }],
      }),
    )
    log.info(again, 'capture')
  } finally {
    await recorder.reset()
  }

  return 0
}
