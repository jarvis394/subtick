/* oxlint-disable no-await-in-loop -- polling loops: each check waits for the game */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Logger } from '@subtick/logger'
import { type NetCon, connectNetCon } from './netcon'

export interface WineGameOptions {
  cs2Dir: string
  prefix: string
  netconPort: number
  /** Folder HLAE hands to CS2 as `USRLOCALCSGO`: our cfg and video settings live here. */
  configDir: string
  log: Logger<unknown>
}

const GAME_START_TIMEOUT_MS = 4 * 60_000
/** The menu line may come before we connect; playdemo's retries cover a still-booting game. */
const MENU_WAIT_MS = 60_000

/** Linux path as Wine programs see it: the prefix's drive C, everything else through Z:. */
export const windowsPath = (prefix: string, path: string) => {
  const driveC = join(prefix, 'drive_c')
  const windows = path.startsWith(`${driveC}/`) ? `C:${path.slice(driveC.length)}` : `Z:${path}`
  return windows.replaceAll('/', '\\')
}

/** Processes whose command line contains `needle` (Wine shows Windows command lines). */
export const findProcesses = async (needle: string) => {
  const pids: number[] = []
  for (const entry of await readdir('/proc')) {
    const pid = Number(entry)
    if (!Number.isInteger(pid) || pid === process.pid) continue
    try {
      const cmdline = await Bun.file(`/proc/${pid}/cmdline`).text()
      if (cmdline.replaceAll('\0', ' ').includes(needle)) pids.push(pid)
    } catch {
      // The process exited while we were looking.
    }
  }
  return pids
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Starts and stops CS2 (through HLAE's loader) in the Wine prefix. The game files carry gbe_fork's
 * steam_api64.dll (laid over them by the bootstrap), so no Steam client runs and no account signs in.
 */
export const createWineGame = (options: WineGameOptions) => {
  const { cs2Dir, prefix, netconPort, configDir, log } = options
  const hlaeDir = join(prefix, 'drive_c/hlae')
  const cs2Exe = join(cs2Dir, 'game/bin/win64/cs2.exe')

  const spawnWine = (args: string[], env: Record<string, string> = {}) =>
    Bun.spawn(['wine', ...args], {
      cwd: args[0]?.startsWith('C:\\hlae') ? hlaeDir : undefined,
      env: { ...process.env, WINEPREFIX: prefix, WINEDEBUG: '-all', ...env },
      stdio: ['ignore', 'ignore', 'ignore'],
    })

  /** Kills every Windows process in the prefix (CS2, HLAE) through its wineserver. */
  const stopAll = async () => {
    await Bun.spawn(['wineserver', '-k'], { env: { ...process.env, WINEPREFIX: prefix } }).exited
    await Bun.spawn(['wineserver', '-w'], { env: { ...process.env, WINEPREFIX: prefix } }).exited
  }

  /** Connects to a running CS2, or starts one through HLAE and waits for its console. */
  const connect = async (): Promise<NetCon> => {
    const consoleLog = { onLine: (line: string) => line && log.trace(line) }
    const running = await connectNetCon(netconPort, consoleLog).catch(() => null)
    if (running) return running

    log.info('starting CS2 through HLAE')
    spawnWine(
      [
        'C:\\hlae\\HLAE.exe',
        '-customLoader',
        '-noGui',
        '-autoStart',
        '-hookDllPath',
        'C:\\hlae\\x64\\AfxHookSource2.dll',
        '-programPath',
        windowsPath(prefix, cs2Exe),
        '-cmdLine',
        [
          '-steam -insecure +sv_lan 1 -console -sw -w 1280 -h 720 -novid -nojoy',
          `-netconport ${netconPort} -afxDisableSteamStorage +exec subtick`,
        ].join(' '),
      ],
      { USRLOCALCSGO: windowsPath(prefix, configDir) },
    )

    const deadline = Date.now() + GAME_START_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(2000)
      const netcon = await connectNetCon(netconPort, consoleLog).catch(() => null)
      if (!netcon) continue
      // The port opens before the game finishes booting; an echo round-trip means it's up.
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

  const kill = async () => {
    const pids = await findProcesses('cs2.exe')
    for (const pid of pids) process.kill(pid, 'SIGKILL')
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
    // stop every Windows process in the prefix so the next start is a fresh game.
    log.warn({ pids }, 'CS2 still answers after the kill; stopping all Windows processes')
    await stopAll()
  }

  return { connect, kill }
}

export type WineGame = ReturnType<typeof createWineGame>
