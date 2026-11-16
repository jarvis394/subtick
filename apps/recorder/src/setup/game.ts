/* oxlint-disable no-await-in-loop -- a handful of folders, linked one by one */
import { copyFile, cp, lstat, mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import pins from '../../pins.json'
import { assets, installAssets } from '../assets'
import { download, extractWindows, readBack, sha256 } from './download'
import { readMarker } from './hlae'
import { createJunction, linkTarget, removeLink, removeTree, samePath } from './links'

/** What identifies a CS2 build on disk: `game/csgo/steam.inf` changes with every update. */
export const gameBuild = async (cs2Dir: string) => {
  const inf = Bun.file(join(cs2Dir, 'game/csgo/steam.inf'))

  return (await inf.exists()) ? sha256(await inf.bytes()) : null
}

const exists = (path: string) =>
  lstat(path).then(
    () => true,
    () => false,
  )

const GBE_DLL = 'release/regular/x64/steam_api64.dll'

/** gbe_fork's steam_api64.dll in `root/gbe`, from its pinned release. */
export const installGbe = async (root: string, log: (message: string) => void) => {
  const gbe = join(root, 'gbe')
  const dll = join(gbe, 'steam_api64.dll')
  if (
    (await readMarker(join(gbe, '.release'))) === pins.gbe.release &&
    (await Bun.file(dll).exists())
  )
    return dll

  log(`downloading gbe_fork ${pins.gbe.release}`)
  await removeTree(gbe)
  const archive = join(gbe, pins.gbe.asset)
  await download(
    `https://github.com/Detanup01/gbe_fork/releases/download/${pins.gbe.release}/${pins.gbe.asset}`,
    archive,
    pins.gbe.sha256,
  )
  await extractWindows(archive, gbe, [GBE_DLL])
  await rename(join(gbe, GBE_DLL), dll)
  await readBack(dll)
  await removeTree(join(gbe, 'release'))
  await removeTree(archive)
  await Bun.write(join(gbe, '.release'), `${pins.gbe.release}\n`)

  return dll
}

export interface GameFolderOptions {
  install: string
  cs2Dir: string
  gbeDll: string
  log: (message: string) => void
}

/**
 * `cs2Dir`: a copy of the install's `game/bin`, where gbe_fork replaces Steam's DLL, and junctions
 * to the rest of `game/`, so the install Steam knows stays as it is. The one thing written there
 * is `game/csgo/subtick`, where demos are copied for playback.
 */
export const buildGameFolder = async ({ install, cs2Dir, gbeDll, log }: GameFolderOptions) => {
  const game = join(cs2Dir, 'game')
  const bin = join(game, 'bin/win64')
  await mkdir(game, { recursive: true })

  const build = await gameBuild(install)
  if (!build) throw new Error(`no game/csgo/steam.inf in ${install}`)
  if (
    (await readMarker(join(cs2Dir, '.build'))) !== build ||
    !(await Bun.file(join(bin, 'cs2.exe')).exists())
  ) {
    log(`copying game/bin from ${install}`)
    await removeTree(join(game, 'bin'))
    await cp(join(install, 'game/bin'), join(game, 'bin'), { recursive: true })
    await Bun.write(join(cs2Dir, '.build'), `${build}\n`)
  }

  for (const entry of await readdir(join(install, 'game'), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'bin') continue
    const path = join(game, entry.name)
    const source = join(install, 'game', entry.name)
    const target = await linkTarget(path)
    if (target && samePath(target, source)) continue
    if (target) {
      log(`relinking game/${entry.name} (it pointed to ${target})`)
      await removeLink(path)
    } else if (await exists(path)) {
      log(`game/${entry.name} is a real folder, not a link to the install: left as it is`)
      continue
    } else log(`linking game/${entry.name}`)
    await createJunction(path, source)
  }

  const current = Bun.file(join(bin, 'steam_api64.dll'))
  const gbe = sha256(await readBack(gbeDll))
  if (!(await current.exists()) || sha256(await current.bytes()) !== gbe) {
    log('installing gbe_fork in place of Steam')
    await copyFile(gbeDll, join(bin, 'steam_api64.dll'))
  }
  await Bun.sleep(1000)
  await readBack(join(bin, 'steam_api64.dll'))

  await removeTree(join(bin, 'steam_settings'))
  await installAssets(assets.steamSettings, join(bin, 'steam_settings'))
  await mkdir(join(bin, 'gse_saves'), { recursive: true })
  await mkdir(join(game, 'csgo/subtick'), { recursive: true })
  // CS2 refuses to start without SteamAPI; with this file it skips relaunching through Steam.
  await Bun.write(join(bin, 'steam_appid.txt'), '730\n')
  await Bun.write(join(cs2Dir, '.install'), `${install}\n`)
}
