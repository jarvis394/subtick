import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const FIXTURE_DIR = join(import.meta.dir, 'fixtures')

export const FIXTURE_URLS = [
  'http://replay392.valve.net/730/003848529647721512967_1183300926.dem.bz2',
  'http://replay410.valve.net/730/003848530066480824350_1006508005.dem.bz2',
  'http://replay186.valve.net/730/003848529815225237570_0369033508.dem.bz2',
]

export const fixturePath = (name: string) => join(FIXTURE_DIR, `${name}.dem`)

/** Demo tests are skipped (not failed) until `bun run fixtures` has been run. */
export const hasFixture = (name: string) => existsSync(fixturePath(name))
