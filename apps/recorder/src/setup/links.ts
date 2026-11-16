/* oxlint-disable no-await-in-loop -- folder walks, one entry at a time */
import { lstat, readdir, readlink, rmdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { isWindows, localPath, powershell, psQuote, windowsPath } from '../platform'

const lstatOrNull = (path: string) => lstat(path).catch(() => null)

/** A symlink or junction. Asking readlink too: a junction must never pass for a real folder. */
export const isLink = async (path: string) => {
  const stat = await lstatOrNull(path)

  return (
    !!stat &&
    (stat.isSymbolicLink() ||
      (await readlink(path).then(
        () => true,
        () => false,
      )))
  )
}

/** Removes a link itself, never what it points to. */
export const removeLink = async (path: string) => {
  try {
    await unlink(path)
  } catch (error) {
    // Windows removes a directory junction as a directory; rmdir won't touch a non-empty real one.
    if (!isWindows) throw error
    await rmdir(path)
  }
}

/**
 * Deletes a folder without ever following a link out of it: links (junctions into the Steam
 * install among them) are removed as links, and only real folders are descended into.
 */
export const removeTree = async (path: string) => {
  const stat = await lstatOrNull(path)
  if (!stat) return
  if (await isLink(path)) return removeLink(path)
  if (!stat.isDirectory()) return unlink(path)
  for (const entry of await readdir(path)) await removeTree(join(path, entry))
  await rmdir(path)
}

/** Where a junction points, as this process reaches it; null when `path` is no link. */
export const linkTarget = async (path: string) => {
  if (!(await isLink(path))) return null
  const target = await readlink(path)

  return localPath(target.replace(/^\\\\\?\\/, '').replace(/^\\\?\?\\/, ''))
}

/** Same place, the way Windows compares paths. */
export const samePath = (a: string, b: string) =>
  windowsPath(a).replace(/\\+$/, '').toLowerCase() ===
  windowsPath(b).replace(/\\+$/, '').toLowerCase()

/** A directory junction: unlike a symlink, Windows makes one without admin rights. */
export const createJunction = async (path: string, target: string) => {
  const { code, stderr } = await powershell(
    `New-Item -ItemType Junction -Path ${psQuote(windowsPath(path))} -Target ${psQuote(windowsPath(target))} | Out-Null`,
  )
  if (code !== 0) throw new Error(`could not link ${path} to ${target}: ${stderr.trim()}`)
}
