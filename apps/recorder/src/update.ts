import { chmod, rename, rm } from 'node:fs/promises'
import { sha256 } from './setup/download'

export const RELEASES_URL = 'https://api.github.com/repos/jarvis394/subtick/releases?per_page=50'
/** The repo releases other things too; the recorder's tags are `recorder-v1.2.3`. */
export const TAG_PREFIX = 'recorder-v'
export const CHECKSUMS = 'SHA256SUMS'

export interface Release {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: { name: string; browser_download_url: string }[]
}

/** The release asset for a platform, or null where the recorder isn't built. */
export const assetName = (platform: string = process.platform, arch: string = process.arch) => {
  if (arch !== 'x64') return null
  if (platform === 'win32') return 'subtick-recorder-windows-x64.exe'
  if (platform === 'linux') return 'subtick-recorder-linux-x64'

  return null
}

const parseVersion = (version: string) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)

  return match ? match.slice(1).map(Number) : null
}

/** Positive when `a` is newer; versions that aren't `x.y.z` (dev builds) are older than any. */
export const compareVersions = (a: string, b: string) => {
  const [va, vb] = [parseVersion(a), parseVersion(b)]
  if (!va || !vb) return Number(!!va) - Number(!!vb)
  const diff = va.findIndex((part, i) => part !== vb[i])

  return diff === -1 ? 0 : va[diff]! - vb[diff]!
}

/** The newest published recorder release that has `asset` and its checksums. */
export const latestRelease = (releases: Release[], asset: string) =>
  releases
    .filter(
      (r) =>
        !r.draft &&
        !r.prerelease &&
        r.tag_name.startsWith(TAG_PREFIX) &&
        parseVersion(r.tag_name.slice(TAG_PREFIX.length)) &&
        r.assets.some((a) => a.name === asset) &&
        r.assets.some((a) => a.name === CHECKSUMS),
    )
    .map((release) => ({ release, version: release.tag_name.slice(TAG_PREFIX.length) }))
    .toSorted((a, b) => compareVersions(b.version, a.version))[0] ?? null

/** `sha256sum` output: `<hex>  <name>` per line (a `*` before the name marks binary mode). */
export const parseChecksums = (text: string) =>
  new Map(
    text
      .split(/\r?\n/)
      .map((line) => /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim()))
      .filter((match) => match !== null)
      .map((match) => [match[2]!, match[1]!.toLowerCase()]),
  )

export const verifyChecksum = (bytes: Uint8Array, sums: Map<string, string>, name: string) => {
  const expected = sums.get(name)
  if (!expected) throw new Error(`${CHECKSUMS} lists no ${name}`)
  const actual = sha256(bytes)
  if (actual !== expected) throw new Error(`${name}: sha256 ${actual}, expected ${expected}`)
}

/**
 * Puts `bytes` in place of the executable at `exe`. Windows can't overwrite a running exe but can
 * rename it, so the old one steps aside as `<exe>.old` and is deleted on the next start.
 */
export const replaceExecutable = async (exe: string, bytes: Uint8Array) => {
  const next = `${exe}.new`
  const old = `${exe}.old`
  await Bun.write(next, bytes)
  await chmod(next, 0o755)
  await rm(old, { force: true })
  await rename(exe, old)
  try {
    await rename(next, exe)
  } catch (error) {
    await rename(old, exe)
    throw error
  }
  await removeOldExecutable(exe)
}

/** Deletes what an update left behind; on Windows only once the old exe has exited. */
export const removeOldExecutable = (exe: string) =>
  rm(`${exe}.old`, { force: true }).catch(() => {})
