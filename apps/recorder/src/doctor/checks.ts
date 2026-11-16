import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import pins from '../../pins.json'
import { gpuName } from '../fleet'
import type { Layout } from '../layout'
import { isWindows, isWsl, powershell, runProgram, windowsPath } from '../platform'
import { checkRedis, checkToken, redactUrl } from '../reachability'
import { self } from '../self'
import { defenderDetections, defenderHint } from '../setup/defender'
import { readBack, sha256 } from '../setup/download'
import { gameBuild } from '../setup/game'
import { readMarker } from '../setup/hlae'
import { tool } from '../tools'

export interface CheckResult {
  status: 'ok' | 'warn' | 'fail'
  detail: string
  fix?: string
}

export interface Check {
  name: string
  run: () => Promise<CheckResult>
}

const ok = (detail: string): CheckResult => ({ status: 'ok', detail })
const fail = (detail: string, fix?: string): CheckResult => ({ status: 'fail', detail, fix })
const warn = (detail: string, fix?: string): CheckResult => ({ status: 'warn', detail, fix })

const exists = (path: string) => Bun.file(path).exists()

export interface DoctorEnv {
  REDIS_URL?: string
  SUBTICK_URL?: string
  RECORDER_TOKEN?: string
  HLAE_VERSION?: string
  HLAE_POV: boolean
}

const rerunSetup = `run \`${self} setup\``

/** The game side on Windows, as `setup` leaves it. */
const windowsChecks = (layout: Layout, env: DoctorEnv): Check[] => {
  const { root, cs2Dir, hlaeDir } = layout
  const bin = join(cs2Dir, 'game/bin/win64')
  const hlaeVersion = env.HLAE_VERSION ?? pins.hlae.version

  return [
    {
      name: 'game folder',
      run: async () => {
        if (!(await exists(join(bin, 'cs2.exe'))))
          return fail(`no CS2 in ${windowsPath(cs2Dir)}`, rerunSetup)
        const [installed, current] = [
          await readMarker(join(cs2Dir, '.build')),
          await gameBuild(cs2Dir),
        ]
        if (!current)
          return fail('the links into the Steam install are broken', `${rerunSetup} (CS2 moved?)`)
        if (installed !== current)
          return fail('CS2 updated since setup copied its binaries', rerunSetup)

        return ok(`${windowsPath(cs2Dir)} matches the Steam install`)
      },
    },
    {
      name: 'Steam emulator',
      run: async () => {
        const gbe = join(root, 'gbe/steam_api64.dll')
        try {
          const [ours, game] = [await readBack(gbe), await readBack(join(bin, 'steam_api64.dll'))]
          if (sha256(ours) !== sha256(game))
            return fail("the game's steam_api64.dll is Steam's, not gbe_fork's", rerunSetup)
        } catch {
          return fail(
            "gbe_fork's steam_api64.dll is missing or unreadable",
            `${rerunSetup}; the Defender line says if Defender took it`,
          )
        }

        return ok(
          `gbe_fork ${(await readMarker(join(root, 'gbe/.release'))) ?? '(unknown release)'}`,
        )
      },
    },
    {
      name: 'Defender',
      run: async () => {
        // What it flagged before the last successful gbe_fork install has been dealt with.
        const installed = await stat(join(root, 'gbe/.release')).catch(() => null)
        const flagged = await defenderDetections(root, installed?.mtime)

        return flagged.length
          ? fail(`flagged ${flagged.join(', ')}`, defenderHint(root))
          : ok(`no new detections under ${windowsPath(root)}`)
      },
    },
    {
      name: 'HLAE',
      run: async () => {
        const installed = await readMarker(join(hlaeDir, '.version'))
        if (!installed || !(await exists(join(hlaeDir, 'HLAE.exe'))))
          return fail(`no HLAE in ${windowsPath(hlaeDir)}`, rerunSetup)
        if (!(await exists(join(hlaeDir, 'ffmpeg/bin/ffmpeg.exe'))))
          return fail("HLAE's ffmpeg.exe is missing", rerunSetup)
        if (installed !== hlaeVersion)
          return warn(`${installed} installed, ${hlaeVersion} wanted`, rerunSetup)

        return ok(installed)
      },
    },
    {
      name: 'hook',
      run: async () => {
        const pov = await readMarker(join(hlaeDir, '.pov-release'))
        if (!env.HLAE_POV)
          return pov
            ? warn('mirv_pov installed but HLAE_POV is off', rerunSetup)
            : ok("HLAE's own (spectator HUD)")
        if (pov !== pins.hlaePov.release)
          return fail(
            `mirv_pov ${pov ?? 'not installed'}, ${pins.hlaePov.release} wanted`,
            rerunSetup,
          )

        return ok(`mirv_pov ${pov.slice(0, 24)}… (player HUD)`)
      },
    },
    ...(isWsl
      ? [
          {
            name: 'WSL networking',
            run: async () => {
              const { stdout } = await runProgram(['wslinfo', '--networking-mode']).catch(() => ({
                stdout: '',
              }))

              return stdout.trim() === 'mirrored'
                ? ok('mirrored')
                : fail(
                    `${stdout.trim() || 'unknown'}: the worker can't reach the game's console`,
                    'set networkingMode=mirrored in %UserProfile%\\.wslconfig, then `wsl --shutdown`',
                  )
            },
          },
        ]
      : []),
  ]
}

/** The game side in the Docker image, as the bootstrap leaves it. */
const wineChecks = (layout: Layout): Check[] => [
  {
    name: 'game folder',
    run: async () =>
      (await exists(join(layout.cs2Dir, 'game/bin/win64/cs2.exe')))
        ? ok(layout.cs2Dir)
        : fail(`no CS2 in ${layout.cs2Dir}`, 'the bootstrap installs it when the container starts'),
  },
  {
    name: 'HLAE',
    run: async () => {
      const installed = await readMarker(join(layout.hlaeDir, '.version'))

      return installed ? ok(installed) : fail(`no HLAE in ${layout.hlaeDir}`)
    },
  },
]

const gpu = async () => {
  const nvidia = await gpuName()
  if (nvidia || !isWindows) return nvidia
  const { stdout } = await powershell(
    '(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }) -join ", "',
  )

  return stdout.trim() || null
}

/** Everything that's the same wherever the recorder runs. */
const commonChecks = (env: DoctorEnv): Check[] => [
  {
    name: 'ffmpeg',
    run: async () => {
      const [ffmpeg, ffprobe] = [tool('ffmpeg'), tool('ffprobe')]
      const missing = [ffmpeg, ffprobe].filter((path) => !Bun.which(path))

      return missing.length
        ? fail(
            `${missing.join(', ')} not found`,
            isWindows || isWsl ? rerunSetup : 'install ffmpeg',
          )
        : ok(ffmpeg)
    },
  },
  {
    name: 'GPU',
    run: async () => {
      const name = await gpu()

      return name ? ok(name) : fail('none found', 'install the GPU driver (nvidia-smi finds none)')
    },
  },
  {
    name: 'Redis',
    run: async () => {
      if (!env.REDIS_URL) return fail('REDIS_URL is not set', 'set it in the config file')
      try {
        await checkRedis(env.REDIS_URL)

        return ok(redactUrl(env.REDIS_URL))
      } catch (error) {
        return fail(
          `${redactUrl(env.REDIS_URL)}: ${(error as Error).message}`,
          "this machine must reach the instance's Redis: an SSH tunnel (ssh -L 6379:127.0.0.1:6379 <server>) or a private network",
        )
      }
    },
  },
  {
    name: 'subtick',
    run: async () => {
      if (!env.SUBTICK_URL || !env.RECORDER_TOKEN)
        return fail('SUBTICK_URL or RECORDER_TOKEN is not set', 'set them in the config file')
      try {
        const identity = await checkToken(env.SUBTICK_URL, env.RECORDER_TOKEN)
        if (!identity)
          return warn(
            `${env.SUBTICK_URL} is older than this recorder, so the token could not be checked`,
            'redeploy subtick to check the token here (or check SUBTICK_URL, if this is not subtick)',
          )

        return ok(
          `${env.SUBTICK_URL} accepts the token as ${identity.name}${identity.paused ? ' (paused)' : ''}`,
        )
      } catch (error) {
        const message = (error as Error).message

        return fail(
          message,
          message.includes('RECORDER_TOKEN')
            ? 'get a new token in subtick: Manage instance -> Recorders'
            : 'check SUBTICK_URL (the instance’s public URL) and that this machine can reach it',
        )
      }
    },
  },
]

export const doctorChecks = (layout: Layout, env: DoctorEnv) => [
  ...(layout.gameHost === 'windows' ? windowsChecks(layout, env) : wineChecks(layout)),
  ...commonChecks(env),
]
