import { copyFile, mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import pins from '../../pins.json'
import { isWindows, runProgram, toolsDir } from '../platform'
import { tool } from '../tools'
import { download, extractWindows } from './download'

/**
 * The Windows ffmpeg build, downloaded once per setup into `downloads`: HLAE encodes with its
 * ffmpeg.exe, and the native worker uses its ffmpeg.exe and ffprobe.exe.
 */
export const windowsFfmpeg = (downloads: string) => {
  const zip = join(downloads, basename(pins.ffmpeg.windows))
  const folder = basename(pins.ffmpeg.windows, '.zip')
  const out = join(downloads, 'ffmpeg')
  let fetched: Promise<void> | undefined

  return async (exe: 'ffmpeg.exe' | 'ffprobe.exe') => {
    fetched ??= download(pins.ffmpeg.windows, zip)
    await fetched
    await extractWindows(zip, out, [`${folder}/bin/${exe}`])

    return join(out, folder, 'bin', exe)
  }
}

/** ffmpeg and ffprobe for the worker's own encoding, unless the system has them. */
export const installWorkerFfmpeg = async (
  windowsExe: ReturnType<typeof windowsFfmpeg>,
  log: (message: string) => void,
) => {
  const dir = toolsDir()
  if (tool('ffmpeg') !== 'ffmpeg' && tool('ffprobe') !== 'ffprobe') return
  log(`installing ffmpeg for the worker in ${dir}`)
  await mkdir(dir, { recursive: true })
  if (isWindows) {
    for (const exe of ['ffmpeg.exe', 'ffprobe.exe'] as const)
      // oxlint-disable-next-line no-await-in-loop -- both come from the same archive
      await copyFile(await windowsExe(exe), join(dir, exe))

    return
  }
  const archive = join(dir, basename(pins.ffmpeg.linux))
  await download(pins.ffmpeg.linux, archive)
  const { code, stderr } = await runProgram([
    'tar',
    '-xJf',
    archive,
    '-C',
    dir,
    '--strip-components=2',
    '--wildcards',
    '*/bin/ffmpeg',
    '*/bin/ffprobe',
  ])
  await Bun.file(archive).delete()
  if (code !== 0) throw new Error(`could not extract ffmpeg: ${stderr.trim()}`)
}
