import { copyFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import pins from '../../pins.json'
import { download, extractWindows, sha256 } from './download'
import { removeTree } from './links'

export interface HlaeOptions {
  root: string
  version: string
  pov: boolean
  /** Extracts a member of HLAE's ffmpeg build to a folder and returns the file's path. */
  ffmpegExe: () => Promise<string>
  log: (message: string) => void
}

export const readMarker = (path: string) =>
  Bun.file(path)
    .text()
    .then((text) => text.trim() || null)
    .catch(() => null)

/** The pinned checksum, or the one GitHub lists for another release (an admin's pick). */
const hlaeSha256 = async (version: string, asset: string) => {
  if (version === pins.hlae.version) return pins.hlae.sha256
  const response = await fetch(
    `https://api.github.com/repos/advancedfx/advancedfx/releases/tags/v${version}`,
  )
  if (!response.ok) throw new Error(`no HLAE release v${version} on GitHub`)
  const release = (await response.json()) as { assets: { name: string; digest?: string }[] }
  const digest = release.assets.find((a) => a.name === asset)?.digest

  return digest?.replace(/^sha256:/, '')
}

/**
 * HLAE and its ffmpeg.exe in `root/hlae`, and with `pov` the mirv_pov fork of its hook over HLAE's
 * own (kept as AfxHookSource2.official.dll to switch back). The same steps as the bootstrap's.
 */
export const installHlae = async ({ root, version, pov, ffmpegExe, log }: HlaeOptions) => {
  const hlae = join(root, 'hlae')
  const hook = join(hlae, 'x64/AfxHookSource2.dll')
  const official = join(hlae, 'x64/AfxHookSource2.official.dll')

  if ((await readMarker(join(hlae, '.version'))) !== version) {
    log(`installing HLAE ${version}`)
    await removeTree(hlae)
    const asset = `hlae_${version.replaceAll('.', '_')}.zip`
    const zip = join(root, '.downloads', asset)
    await download(
      `https://github.com/advancedfx/advancedfx/releases/download/v${version}/${asset}`,
      zip,
      await hlaeSha256(version, asset),
    )
    await extractWindows(zip, hlae)
    await mkdir(join(hlae, 'ffmpeg/bin'), { recursive: true })
    await copyFile(await ffmpegExe(), join(hlae, 'ffmpeg/bin/ffmpeg.exe'))
    await Bun.write(join(hlae, '.version'), `${version}\n`)
  }

  if (!pov) {
    if (await Bun.file(official).exists()) {
      log("restoring HLAE's own AfxHookSource2.dll")
      await copyFile(official, hook)
      await rm(official)
      await rm(join(hlae, '.pov-release'), { force: true })
    }

    return null
  }
  const fork = pins.hlaePov
  if (fork.hlaeVersion !== version) {
    log(
      `mirv_pov is built for HLAE ${fork.hlaeVersion}, not ${version}: keeping HLAE's own hook (spectator HUD)`,
    )
    await rm(join(hlae, '.pov-release'), { force: true })

    return null
  }
  const forkDir = join(root, 'hlae-pov')
  const forkDll = join(forkDir, 'AfxHookSource2.dll')
  if ((await readMarker(join(forkDir, '.release'))) !== fork.release) {
    log(`downloading mirv_pov ${fork.release}`)
    await removeTree(forkDir)
    const zip = join(root, '.downloads', fork.asset)
    await download(
      `https://github.com/WangChuDi/advancedfx/releases/download/${fork.release}/${fork.asset}`,
      zip,
      fork.sha256,
    )
    await extractWindows(zip, forkDir)
    if (!(await Bun.file(forkDll).exists()))
      throw new Error(`no AfxHookSource2.dll in ${fork.asset}`)
    await Bun.write(join(forkDir, '.release'), `${fork.release}\n`)
  }
  if (!(await Bun.file(official).exists())) await copyFile(hook, official)
  const same =
    (await Bun.file(hook).exists()) &&
    sha256(await Bun.file(hook).bytes()) === sha256(await Bun.file(forkDll).bytes())
  if (!same) {
    log(`installing mirv_pov (${fork.release})`)
    await copyFile(forkDll, hook)
  }
  await Bun.write(join(hlae, '.pov-release'), `${fork.release}\n`)

  return fork.release
}
