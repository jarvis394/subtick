import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { runProgram, windowsPath, windowsTool } from '../platform'

export const sha256 = (data: Uint8Array | ArrayBuffer) =>
  new Bun.CryptoHasher('sha256').update(data).digest('hex')

/** The file could not be read back: an antivirus took it away or locked it. */
export class BlockedFileError extends Error {
  override name = 'BlockedFileError'
}

/** Reads a file we just wrote, which Defender may have quarantined in between. */
export const readBack = async (path: string) => {
  try {
    return await Bun.file(path).bytes()
  } catch (error) {
    throw new BlockedFileError(`${path} was written but can't be read back`, { cause: error })
  }
}

/** Downloads `url` to `path`; with `sha256`, refuses anything else, checked on the file written. */
export const download = async (url: string, path: string, expected?: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download failed: ${url}: HTTP ${response.status}`)
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, await response.bytes())
  if (!expected) return
  // Real-time scanning acts on the written file, not on the bytes in memory.
  await Bun.sleep(1000)
  const actual = sha256(await readBack(path))
  if (actual !== expected)
    throw new Error(`${basename(path)}: sha256 ${actual}, expected ${expected} (${url})`)
}

/** Extracts members of a zip or 7z with Windows' own tar, which reads both. */
export const extractWindows = async (archive: string, dir: string, members: string[] = []) => {
  await mkdir(dir, { recursive: true })
  const { code, stderr } = await runProgram(
    [windowsTool.tar, '-xf', windowsPath(archive), '-C', windowsPath(dir), ...members],
    dir,
  )
  if (code !== 0) throw new Error(`could not extract ${basename(archive)}: ${stderr.trim()}`)
}
