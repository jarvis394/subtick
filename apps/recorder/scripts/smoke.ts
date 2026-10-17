/**
 * One clip end to end, without the database or the queue: start CS2 the way the worker would
 * (same HLAE_POV), load a demo, record a two-segment clip of one player, then
 * restart the game, load the demo again and record once more. Run it inside a
 * recorder container after a deploy, with the worker's container removed (they share the GPU):
 *   docker run --rm ... --env-file recorder.env -v <demos>:/demos:ro subtick-recorder \
 *     bun apps/recorder/scripts/smoke.ts /demos/match.dem 20000 "player name"
 * The capture stays in the prefix (drive_c/subtick/takes/smoke*) for a look.
 */
import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger } from '@subtick/logger'
import { Cs2Recorder } from '../src/cs2/recorder'
import { createWineGame } from '../src/cs2/wine'

const [demoPath, tick = '20000', playerName = ''] = process.argv.slice(2)
if (!demoPath) throw new Error('usage: bun smoke.ts <demo.dem> [startTick] [player name]')
const startTick = Number(tick)

const log = createLogger('smoke')
const prefix = process.env.WINEPREFIX ?? '/wine/pfx'
const cs2Dir = process.env.CS2_DIR ?? '/cs2'
const configDir = join(prefix, 'drive_c/subtick')
await cp(new URL('../cfg', import.meta.url).pathname, join(configDir, 'cfg'), { recursive: true })

const game = createWineGame({ cs2Dir, prefix, netconPort: 2121, configDir, log })
const recorder = new Cs2Recorder({
  game,
  cs2Dir,
  prefix,
  takesDir: join(configDir, 'takes'),
  mirvPov: process.env.HLAE_POV === '1',
  log,
})

const time = async <T>(label: string, task: () => Promise<T>) => {
  const start = performance.now()
  const result = await task()
  log.info({ seconds: +((performance.now() - start) / 1000).toFixed(1) }, label)
  return result
}

const second = 64
try {
  log.info({ pov: process.env.HLAE_POV === '1', startTick, playerName }, 'smoke test')
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
