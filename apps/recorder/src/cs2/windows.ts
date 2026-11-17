import { dirname } from 'node:path'
import { isWsl, powershell, runProgram, windowsPath, windowsTool } from '../platform'
import type { GameHost } from './host'

/** One line per process: pid, executable, command line. Only what the recorder can have started. */
const LIST_PROCESSES = [
  `Get-CimInstance Win32_Process -Filter "Name='cs2.exe' OR Name='HLAE.exe' OR Name='ffmpeg.exe'"`,
  '| ForEach-Object { "$($_.ProcessId)`t$($_.ExecutablePath)`t$($_.CommandLine)" }',
].join(' ')

const kill = async (pids: number[]) => {
  if (pids.length)
    await runProgram([windowsTool.taskkill, '/F', ...pids.flatMap((pid) => ['/PID', String(pid)])])
}

/**
 * Windows itself: programs start on the signed-in desktop with the real GPU driver, directly or
 * through WSL's interop. `dirs` are the recorder's own folders; processes started from anywhere
 * else (the CS2 someone is playing) are never seen or killed.
 */
export const createWindowsHost = (dirs: string[]): GameHost => {
  // With the separator, C:\subtick doesn't also claim C:\subtick-dev.
  const own = dirs
    .map((dir) => windowsPath(dir).toLowerCase())
    .map((dir) => (dir.endsWith('\\') ? dir : `${dir}\\`))

  const list = async () => {
    const { stdout } = await powershell(LIST_PROCESSES)

    return stdout
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((fields) => fields.length >= 3)
      .map(([pid, ...rest]) => ({ pid: Number(pid), command: rest.join(' ') }))
      .filter(({ command }) => own.some((dir) => command.toLowerCase().includes(dir)))
  }

  return {
    spawn(program, args, extra = {}) {
      const env = { ...process.env, ...extra }
      // WSLENV names the variables interop hands on to Windows programs.
      if (isWsl) env.WSLENV = [process.env.WSLENV, ...Object.keys(extra)].filter(Boolean).join(':')
      Bun.spawn([program, ...args], {
        cwd: dirname(program),
        env,
        stdio: ['ignore', 'ignore', 'ignore'],
      }).unref()
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
