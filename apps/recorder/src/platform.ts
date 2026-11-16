import { homedir, release } from 'node:os'
import { join, win32 } from 'node:path'

/**
 * The one place that knows how this process reaches Windows: natively (the Windows build), or
 * through WSL's interop from a worker run from source in WSL. Only paths and the location of
 * Windows' own tools differ between the two.
 */
export const isWindows = process.platform === 'win32'
export const isWsl = process.platform === 'linux' && /microsoft/i.test(release())

/** Windows' System32 as this process reaches it. */
export const system32 = isWindows
  ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
  : '/mnt/c/Windows/System32'

export const windowsTool = {
  powershell: join(system32, 'WindowsPowerShell/v1.0/powershell.exe'),
  taskkill: join(system32, 'taskkill.exe'),
  tar: join(system32, 'tar.exe'),
  reg: join(system32, 'reg.exe'),
}

/** A path of this process as Windows programs see it: WSL's `/mnt/c/...` becomes `C:\...`. */
export const windowsPath = (path: string) => {
  if (isWindows) return win32.normalize(path)
  const drive = /^\/mnt\/([a-z])(\/.*)?$/.exec(path)
  if (!drive) throw new Error(`${path} is not on a Windows drive (/mnt/<letter>/...)`)

  return `${drive[1]!.toUpperCase()}:${drive[2] ?? '/'}`.replaceAll('/', '\\')
}

/** A path from Windows or a config file as this process reaches it: `C:\...` is `/mnt/c/...` in WSL. */
export const localPath = (path: string) => {
  if (isWindows) return win32.normalize(path)
  const drive = /^([a-zA-Z]):[\\/]?(.*)$/.exec(path)
  if (!drive) return path

  return `/mnt/${drive[1]!.toLowerCase()}/${drive[2]!.replaceAll('\\', '/')}`.replace(/\/+$/, '')
}

/** Where the config file lives, unless SUBTICK_RECORDER_CONFIG names another. */
export const configHome = () =>
  isWindows
    ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'subtick-recorder')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'subtick-recorder')

/** The worker's own tools (ffmpeg, ffprobe): outside the game folder, whose processes get killed. */
export const toolsDir = () =>
  isWindows
    ? join(configHome(), 'ffmpeg')
    : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'subtick-recorder/ffmpeg')

/** Runs a program and resolves with its output, whatever its exit code. */
export const runProgram = async (command: string[], cwd?: string) => {
  const proc = Bun.spawn(command, { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout, stderr, code }
}

/** Runs a PowerShell script on Windows. */
export const powershell = (script: string) =>
  // -EncodedCommand takes UTF-16LE base64: no quoting survives two shells otherwise.
  runProgram([
    windowsTool.powershell,
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64'),
  ])

/** A string as a single-quoted PowerShell literal. */
export const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`
