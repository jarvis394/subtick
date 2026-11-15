import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { GameHost } from './host'

/** Linux path as Wine programs see it: the prefix's drive C, everything else through Z:. */
export const windowsPath = (prefix: string, path: string) => {
  const driveC = join(prefix, 'drive_c')
  const windows = path.startsWith(`${driveC}/`) ? `C:${path.slice(driveC.length)}` : `Z:${path}`

  return windows.replaceAll('/', '\\')
}

/**
 * Processes whose command line contains `needle` but not `exclude` (Wine shows Windows command
 * lines).
 */
const findProcesses = async (needle: string, exclude?: string) => {
  const pids: number[] = []
  for (const entry of await readdir('/proc')) {
    const pid = Number(entry)
    if (!Number.isInteger(pid) || pid === process.pid) continue
    try {
      // oxlint-disable-next-line no-await-in-loop -- a few hundred small reads
      const cmdline = (await Bun.file(`/proc/${pid}/cmdline`).text()).replaceAll('\0', ' ')
      if (cmdline.includes(needle) && !(exclude && cmdline.includes(exclude))) pids.push(pid)
    } catch {
      // The process exited while we were looking.
    }
  }

  return pids
}

/** Windows programs under Wine on Linux, in the prefix the bootstrap set up. */
export const createWineHost = (prefix: string): GameHost => {
  const env = { ...process.env, WINEPREFIX: prefix }

  return {
    spawn(program, args, extra = {}) {
      Bun.spawn(['wine', windowsPath(prefix, program), ...args], {
        cwd: dirname(program),
        env: { ...env, WINEDEBUG: '-all', ...extra },
        stdio: ['ignore', 'ignore', 'ignore'],
      })
    },
    processes: findProcesses,
    async kill(pids) {
      for (const pid of pids) process.kill(pid, 'SIGKILL')
    },
    /** Kills every Windows process in the prefix (CS2, HLAE) through its wineserver. */
    async stopAll() {
      await Bun.spawn(['wineserver', '-k'], { env }).exited
      await Bun.spawn(['wineserver', '-w'], { env }).exited
    },
    windowsPath: (path) => windowsPath(prefix, path),
  }
}
