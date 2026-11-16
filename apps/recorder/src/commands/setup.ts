import { join } from 'node:path'
import pins from '../../pins.json'
import { configPath, ensureConfigFile, setConfigValues } from '../config-file'
import { DEFAULT_WINDOWS_DIR } from '../layout'
import { isWindows, isWsl, localPath, windowsPath } from '../platform'
import { defenderDetections, defenderHint } from '../setup/defender'
import { installWorkerFfmpeg, windowsFfmpeg } from '../setup/ffmpeg'
import { buildGameFolder, installGbe } from '../setup/game'
import { installHlae } from '../setup/hlae'
import { removeTree } from '../setup/links'
import { findCs2Install } from '../setup/steam'
import { self } from '../self'

const log = (message: string) => console.log(`[setup] ${message}`)

export interface SetupFlags {
  dir?: string
  cs2Install?: string
}

/**
 * Installs everything the game side needs on Windows: HLAE (and the mirv_pov hook with HLAE_POV=1),
 * gbe_fork, the game folder built from the Steam install, and ffmpeg. Idempotent; run it again
 * after a CS2 update.
 */
export const setup = async (flags: SetupFlags) => {
  if (!isWindows && !isWsl) {
    console.error(
      'setup installs the recorder on Windows. On Linux the game runs in the Docker image (see the README).',
    )

    return 1
  }
  const started = Date.now()
  const env = process.env
  const root = localPath(flags.dir ?? env.WINDOWS_DIR ?? DEFAULT_WINDOWS_DIR)
  const cs2Dir = env.CS2_DIR ? localPath(env.CS2_DIR) : join(root, 'cs2')
  const config = configPath()

  const found = flags.cs2Install ?? env.CS2_INSTALL
  const located = found ? { install: localPath(found), looked: found } : await findCs2Install()
  if (!located.install) {
    console.error(
      `Can't find CS2 (${located.looked}). Install it with Steam, or pass --cs2-install "<the folder that holds game\\>".`,
    )

    return 1
  }
  const install = located.install
  log(`CS2: ${windowsPath(install)}`)
  log(`installing into ${windowsPath(root)}`)

  const created = await ensureConfigFile(config, {
    WINDOWS_DIR: windowsPath(root),
    ...(isWsl ? { GAME_HOST: 'windows' } : {}),
  })
  if (!created && flags.dir) await setConfigValues(config, { WINDOWS_DIR: windowsPath(root) })

  const downloads = join(root, '.downloads')
  const ffmpegExe = windowsFfmpeg(downloads)
  try {
    await installHlae({
      root,
      version: env.HLAE_VERSION ?? pins.hlae.version,
      pov: env.HLAE_POV === '1',
      ffmpegExe: () => ffmpegExe('ffmpeg.exe'),
      log,
    })
    const gbeDll = await installGbe(root, log)
    await buildGameFolder({ install, cs2Dir, gbeDll, log })
    await installWorkerFfmpeg(ffmpegExe, log)
  } catch (error) {
    const flagged = await defenderDetections(root, new Date(started - 60_000))
    if (!flagged.length) throw error
    console.error(`\n${defenderHint(root)}\n\nFlagged: ${flagged.join(', ')}`)

    return 1
  } finally {
    await removeTree(downloads)
  }

  const missing = ['SUBTICK_URL', 'RECORDER_TOKEN', 'REDIS_URL'].filter((key) => !env[key])
  log('ready.')
  log(`${created ? 'created' : 'settings in'} ${config}`)
  if (missing.length) log(`fill in ${missing.join(', ')} there, then:`)
  log(`  ${self} doctor   checks everything`)
  log(`  ${self} run      starts recording`)
  log(`Run \`${self} setup\` again after a CS2 update.`)

  return 0
}
