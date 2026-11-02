import { join } from 'node:path'

const read = (path: string) =>
  Bun.file(path)
    .text()
    .catch(() => '')

/** The CS2 build a Steam install is on, from its app manifest. */
const installedBuild = async (dir: string) =>
  (await read(join(dir, 'steamapps/appmanifest_730.acf'))).match(/"buildid"\s+"(\d+)"/)?.[1]

/**
 * CS2_SOURCE=server: the server updated past the Windows binaries the bootstrap downloaded for it.
 * CS2 then never brings its console up ("no netcon answer"), so recording can't work until the
 * bootstrap runs again.
 */
export const staleWindowsBinaries = async (cs2Dir: string, serverDir: string) => {
  const server = await installedBuild(serverDir)
  const binaries = (await read(join(cs2Dir, '.windows-binaries/.build'))).trim()
  return server && binaries && server !== binaries ? { server, binaries } : null
}
