/* oxlint-disable no-await-in-loop -- polling loops: each check waits for the game */
import { readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Logger } from '@subtick/logger'
import type { Resolution } from './config'
import type { GameHost } from './host'
import { type NetCon, connectNetCon } from './netcon'

export interface GameOptions {
  /** Where the Windows programs run: Wine on Linux, or Windows itself under WSL. */
  host: GameHost
  cs2Dir: string
  /** HLAE's folder, as the bootstrap or `scripts/setup-wsl.sh` laid it out. */
  hlaeDir: string
  netconPort: number
  /** Folder HLAE hands to CS2 as `USRLOCALCSGO`: our cfg and video settings live here. */
  configDir: string
  resolution: Resolution
  log: Logger<unknown>
}

const GAME_START_TIMEOUT_MS = 4 * 60_000
/** The menu line may come before we connect; playdemo's retries cover a still-booting game. */
const MENU_WAIT_MS = 60_000
/** How long HLAE may take to bring cs2.exe up. */
const CS2_SPAWN_MS = 90_000

/** CS2 went away while booting: most often a CS2 update the hook DLL doesn't match yet. */
class GameExitedError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The newest `*.mdmp` in `dir` written after `since`: CS2 leaves one next to cs2.exe when it crashes. */
export const findCrashDump = async (dir: string, since: number) => {
  const names = (await readdir(dir).catch(() => [])).filter((name) => name.endsWith('.mdmp'))
  const dumps = await Promise.all(
    names.map(async (name) => ({
      name,
      mtime: await stat(join(dir, name)).then(
        (s) => s.mtimeMs,
        () => 0,
      ),
    })),
  )

  return dumps.filter((d) => d.mtime > since).toSorted((a, b) => b.mtime - a.mtime)[0]?.name ?? null
}

/**
 * Starts and stops CS2 through HLAE's loader. The game files carry gbe_fork's steam_api64.dll
 * (laid over them at setup), so no Steam client runs and no account signs in.
 */
export const createGame = (options: GameOptions) => {
  const { host, cs2Dir, hlaeDir, netconPort, configDir, resolution, log } = options
  const cs2Exe = join(cs2Dir, 'game/bin/win64/cs2.exe')
  const hook = join(hlaeDir, 'x64/AfxHookSource2.dll')
  /** HLAE's own hook, kept here when the mirv_pov fork is laid over it. */
  const officialHook = join(hlaeDir, 'x64/AfxHookSource2.official.dll')

  const consoleLog = { onLine: (line: string) => line && log.trace(line) }
  let since = Date.now()

  /** A minidump CS2 wrote since this game was started or connected to, if any (Wine may write none). */
  const crashDump = () => findCrashDump(dirname(cs2Exe), since)

  /** Starts CS2 through HLAE with `hook` and waits for its console. */
  const start = async (hookDll: string): Promise<NetCon> => {
    log.info({ hook: hookDll }, 'starting CS2 through HLAE')
    since = Date.now()
    host.spawn(
      join(hlaeDir, 'HLAE.exe'),
      [
        '-customLoader',
        '-noGui',
        // A config HLAE saved on this machine would otherwise apply to the launch.
        '-noConfig',
        '-autoStart',
        '-hookDllPath',
        host.windowsPath(hookDll),
        '-programPath',
        host.windowsPath(cs2Exe),
        '-cmdLine',
        [
          `-steam -insecure +sv_lan 1 -console -sw -w ${resolution.width} -h ${resolution.height} -novid -nojoy`,
          `-netconport ${netconPort} -afxDisableSteamStorage +exec subtick`,
        ].join(' '),
      ],
      { USRLOCALCSGO: host.windowsPath(configDir) },
    )

    const startedAt = Date.now()
    let spawned = false
    while (Date.now() < startedAt + GAME_START_TIMEOUT_MS) {
      await sleep(2000)
      // HLAE's own command line names cs2.exe too.
      const alive = (await host.processes('cs2.exe', 'HLAE.exe')).length > 0
      if (spawned && !alive) {
        const dump = await crashDump()
        throw new GameExitedError(
          dump
            ? `CS2 crashed while starting (minidump ${dump}; a CS2 update can break HLAE: bump HLAE_VERSION)`
            : 'CS2 exited while starting (a CS2 update can break HLAE: bump HLAE_VERSION)',
        )
      }
      spawned ||= alive
      if (!spawned && Date.now() > startedAt + CS2_SPAWN_MS) {
        throw new Error('CS2 did not start: HLAE never launched cs2.exe')
      }
      const netcon = await connectNetCon(netconPort, consoleLog).catch(() => null)
      if (!netcon) continue
      // The port opens early in boot. Once the console echoes, wait for the menu's background
      // map: until then CS2 ignores host changes like `playdemo`.
      const menu = netcon.waitFor(/Signon traffic "server"/, MENU_WAIT_MS)
      menu.catch(() => {})
      netcon.send('echo subtick_ready')
      const up = await netcon.waitFor(/^subtick_ready$/, 5000).catch(() => null)
      if (!up) {
        netcon.close()
        continue
      }
      await menu.catch(() => {})
      // CS2 sometimes drops console clients that connected early in boot; connect again.
      if (netcon.closed) continue
      await Bun.sleep(3000)
      if (!netcon.closed) return netcon
    }
    throw new Error('CS2 did not start: no netcon answer')
  }

  /**
   * Connects to a running CS2, or starts one. The mirv_pov fork lags behind CS2 updates; when the
   * game dies with it, it starts again with HLAE's own hook (clips then get the spectator HUD).
   */
  const connect = async (): Promise<NetCon> => {
    const running = await connectNetCon(netconPort, consoleLog).catch(() => null)
    if (running) {
      since = Date.now()

      return running
    }
    try {
      return await start(hook)
    } catch (error) {
      if (!(error instanceof GameExitedError) || !(await Bun.file(officialHook).exists()))
        throw error
      log.warn("CS2 exited while starting with the mirv_pov hook; retrying with HLAE's own")
      await host.stopAll()

      return start(officialHook)
    }
  }

  const kill = async () => {
    const pids = await host.processes('cs2.exe')
    await host.kill(pids)
    if (pids.length) log.warn({ pids }, 'killed CS2')
    // Until its console port closes, a dying game would still accept the next connection, and
    // `connect` would take it for a running one.
    for (let i = 0; i < (pids.length ? 30 : 1); i++) {
      const netcon = await connectNetCon(netconPort).catch(() => null)
      if (!netcon) return
      netcon.close()
      await sleep(1000)
    }
    // Still answering, or answering though no cs2.exe was found (seen after a timed-out clip):
    // stop every Windows process of ours so the next start is a fresh game.
    log.warn({ pids }, 'CS2 still answers after the kill; stopping all Windows processes')
    await host.stopAll()
  }

  return { connect, kill, crashDump, host }
}

export type Game = ReturnType<typeof createGame>
