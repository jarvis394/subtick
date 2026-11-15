import { dirname, join } from 'node:path'
import { HLAE_BUILD_PATTERNS, type HlaeBuild } from '@subtick/domain'

const read = (path: string) =>
  Bun.file(path)
    .text()
    .then((text) => text.trim() || null)
    .catch(() => null)

/** What the bootstrap installed: HLAE's version, and the mirv_pov release laid over it if any. */
export const installedHlae = async (prefix: string) => {
  const dir = join(prefix, 'drive_c/hlae')

  return {
    hlaeVersion: await read(join(dir, '.version')),
    hlaePovRelease: await read(join(dir, '.pov-release')),
  }
}

/** Without HLAE_POV the fork isn't installed, so only HLAE's version counts. */
export const needsHlaeUpdate = (
  target: HlaeBuild | null | undefined,
  installed: { hlaeVersion: string | null; hlaePovRelease: string | null },
  pov: boolean,
): target is HlaeBuild =>
  !!target &&
  (target.hlae !== installed.hlaeVersion || (pov && target.povRelease !== installed.hlaePovRelease))

/**
 * Leaves the build for the bootstrap (next to the prefix) to install on the next start; false when
 * it was already left there. The bootstrap reads it in shell, so every value must match its pattern.
 */
export const writeHlaeTarget = async (prefix: string, target: HlaeBuild) => {
  const keys = Object.keys(HLAE_BUILD_PATTERNS) as (keyof HlaeBuild)[]
  const bad = keys.find((key) => !HLAE_BUILD_PATTERNS[key].test(target[key]))
  if (bad) throw new Error(`refusing an HLAE build with a malformed ${bad}`)

  const file = join(dirname(prefix), 'hlae-target')
  const lines = keys.map((key) => `${key}=${target[key]}\n`).join('')
  if ((await read(file)) === lines.trim()) return false
  await Bun.write(file, lines)

  return true
}
