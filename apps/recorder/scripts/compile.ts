/**
 * Compiles the recorder for Windows and Linux into dist/, with SHA256SUMS:
 * `bun run compile [windows|linux]`. VERSION is the version they report (the release workflow
 * passes the tag's).
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256 } from '../src/setup/download'
import { assetName } from '../src/update'
import pkg from '../package.json'

const TARGETS = {
  windows: { bun: 'bun-windows-x64', platform: 'win32' },
  linux: { bun: 'bun-linux-x64', platform: 'linux' },
}

const version = process.env.VERSION || `${pkg.version}-dev`
const dist = join(import.meta.dir, '../dist')
const picked = Bun.argv.slice(2) as (keyof typeof TARGETS)[]
const targets = picked.length ? picked : (Object.keys(TARGETS) as (keyof typeof TARGETS)[])

await mkdir(dist, { recursive: true })
const sums: string[] = []

for (const target of targets) {
  const { bun, platform } = TARGETS[target]
  const name = assetName(platform, 'x64')!
  const outfile = join(dist, name)
  // oxlint-disable-next-line no-await-in-loop -- one compile at a time keeps the output readable
  const code = await Bun.spawn(
    [
      'bun',
      'build',
      '--compile',
      `--target=${bun}`,
      '--minify-syntax',
      `--define=SUBTICK_RECORDER_VERSION=${JSON.stringify(version)}`,
      join(import.meta.dir, '../src/cli.ts'),
      '--outfile',
      outfile,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  ).exited
  if (code !== 0) process.exit(code)
  // oxlint-disable-next-line no-await-in-loop -- as above
  sums.push(`${sha256(await Bun.file(outfile).bytes())}  ${name}`)
}

await Bun.write(join(dist, 'SHA256SUMS'), `${sums.join('\n')}\n`)
console.log(`subtick-recorder ${version}: ${targets.join(', ')} in ${dist}`)
