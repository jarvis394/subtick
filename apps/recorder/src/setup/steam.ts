import { join } from 'node:path'
import { localPath, runProgram, windowsTool } from '../platform'

export interface Vdf {
  [key: string]: string | Vdf
}

const unquote = (token: string) => token.slice(1, -1).replace(/\\(.)/g, '$1')

/** Valve's KeyValues text (`libraryfolders.vdf`, `appmanifest_*.acf`): quoted keys, values and `{}`. */
export const parseVdf = (text: string): Vdf => {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}]/g) ?? []
  let i = 0

  const object = (): Vdf => {
    const out: Vdf = {}
    while (i < tokens.length) {
      const key = tokens[i++]!
      if (key === '}') break
      const value = tokens[i++]
      if (value === undefined) break
      out[unquote(key)] = value === '{' ? object() : unquote(value)
    }

    return out
  }

  return object()
}

const child = (vdf: Vdf | string | undefined, key: string) =>
  typeof vdf === 'object' ? vdf[key] : undefined

const CS2_APP_ID = '730'

/** The Steam libraries in `libraryfolders.vdf`, the one holding CS2 first. */
export const steamLibraries = (libraryFolders: string) => {
  const folders = child(parseVdf(libraryFolders), 'libraryfolders')
  if (typeof folders !== 'object') return []
  const libraries = Object.values(folders).flatMap((entry) => {
    const path = child(entry, 'path')

    return typeof path === 'string'
      ? [{ path, hasCs2: typeof child(child(entry, 'apps'), CS2_APP_ID) === 'string' }]
      : []
  })

  return libraries.toSorted((a, b) => Number(b.hasCs2) - Number(a.hasCs2)).map(({ path }) => path)
}

/** CS2's folder name and build from `appmanifest_730.acf`. */
export const parseAppManifest = (manifest: string) => {
  const state = child(parseVdf(manifest), 'AppState')
  const installdir = child(state, 'installdir')
  const buildid = child(state, 'buildid')

  return {
    installdir: typeof installdir === 'string' ? installdir : null,
    buildid: typeof buildid === 'string' ? buildid : null,
  }
}

/** Steam's own folder, from the registry: `c:/programs/steam`. */
const steamFromRegistry = async () => {
  const keys = [
    ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
    ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
  ]
  for (const [key, value] of keys) {
    // oxlint-disable-next-line no-await-in-loop -- the first key found wins
    const { stdout } = await runProgram([windowsTool.reg, 'query', key!, '/v', value!]).catch(
      () => ({ stdout: '' }),
    )
    const path = new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`).exec(stdout)?.[1]?.trim()
    if (path) return path
  }

  return null
}

const read = (path: string) =>
  Bun.file(path)
    .text()
    .catch(() => null)

/**
 * The CS2 install Steam knows (the folder that holds `game/`), from the registry and Steam's
 * library list, or null with what was looked at.
 */
export const findCs2Install = async () => {
  const steam = await steamFromRegistry()
  if (!steam) return { install: null, looked: 'no Steam in the registry' }
  const steamDir = localPath(steam)
  const folders = await read(join(steamDir, 'steamapps/libraryfolders.vdf'))
  const libraries = folders ? steamLibraries(folders).map(localPath) : [steamDir]
  for (const library of libraries) {
    // oxlint-disable-next-line no-await-in-loop -- usually one or two libraries
    const manifest = await read(join(library, 'steamapps', `appmanifest_${CS2_APP_ID}.acf`))
    const { installdir } = manifest ? parseAppManifest(manifest) : { installdir: null }
    const install = installdir && join(library, 'steamapps/common', installdir)
    // oxlint-disable-next-line no-await-in-loop -- as above
    if (install && (await Bun.file(join(install, 'game/bin/win64/cs2.exe')).exists()))
      return { install, looked: libraries.join(', ') }
  }

  return { install: null, looked: `Steam libraries ${libraries.join(', ')}` }
}
