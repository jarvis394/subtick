import { dirname } from 'node:path'
import type { GameHost } from './host'

const SYSTEM32 = '/mnt/c/Windows/System32'
const POWERSHELL = `${SYSTEM32}/WindowsPowerShell/v1.0/powershell.exe`
const TASKKILL = `${SYSTEM32}/taskkill.exe`

/** One line per process: pid, executable, command line. Only what the recorder can have started. */
const LIST_PROCESSES = [
  `Get-CimInstance Win32_Process -Filter "Name='cs2.exe' OR Name='HLAE.exe' OR Name='ffmpeg.exe'"`,
  '| ForEach-Object { "$($_.ProcessId)`t$($_.ExecutablePath)`t$($_.CommandLine)" }',
].join(' ')

/** A WSL path on a Windows drive (`/mnt/c/...`) as Windows sees it. */
export const windowsPath = (path: string) => {
  const drive = /^\/mnt\/([a-z])(\/.*)?$/.exec(path)
  if (!drive) throw new Error(`${path} is not on a Windows drive (/mnt/<letter>/...)`)

  return `${drive[1]!.toUpperCase()}:${drive[2] ?? '/'}`.replaceAll('/', '\\')
}

const run = async (command: string[]) => {
  const proc = Bun.spawn(command, { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' })
  const out = await new Response(proc.stdout).text()
  await proc.exited

  return out
}

const kill = async (pids: number[]) => {
  if (pids.length) await run([TASKKILL, '/F', ...pids.flatMap((pid) => ['/PID', String(pid)])])
}

/**
 * Windows itself, from a worker running in WSL: programs start through WSL's interop on the
 * signed-in desktop, with the real GPU driver. `dirs` are the recorder's own folders; processes
 * started from anywhere else (the CS2 someone is playing) are never seen or killed.
 */
export const createWindowsHost = (dirs: string[]): GameHost => {
  const own = dirs.map((dir) => windowsPath(dir).toLowerCase())
  // -EncodedCommand takes UTF-16LE base64: no quoting survives two shells otherwise.
  const listCommand = Buffer.from(LIST_PROCESSES, 'utf16le').toString('base64')

  const list = async () => {
    const out = await run([
      POWERSHELL,
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      listCommand,
    ])

    return out
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((fields) => fields.length >= 3)
      .map(([pid, ...rest]) => ({ pid: Number(pid), command: rest.join(' ') }))
      .filter(({ command }) => own.some((dir) => command.toLowerCase().includes(dir)))
  }

  return {
    spawn(program, args, extra = {}) {
      Bun.spawn([program, ...args], {
        cwd: dirname(program),
        // WSLENV names the variables interop hands on to Windows programs.
        env: {
          ...process.env,
          ...extra,
          WSLENV: [process.env.WSLENV, ...Object.keys(extra)].filter(Boolean).join(':'),
        },
        stdio: ['ignore', 'ignore', 'ignore'],
      })
    },
    async processes(needle, exclude) {
      const all = await list()

      return all
        .filter(
          ({ command }) => command.includes(needle) && !(exclude && command.includes(exclude)),
        )
        .map(({ pid }) => pid)
    },
    kill,
    stopAll: async () => kill((await list()).map(({ pid }) => pid)),
    windowsPath,
  }
}
