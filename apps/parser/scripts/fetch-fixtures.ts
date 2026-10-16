/**
 * Downloads the test demos into test/fixtures (gitignored). Valve deletes demos after ~30 days,
 * so keep a local copy around once fetched.
 *   bun run fixtures
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE_DIR, FIXTURE_URLS } from '../test/fixtures'

await mkdir(FIXTURE_DIR, { recursive: true })

await Promise.all(
  FIXTURE_URLS.map(async (url) => {
    const target = join(
      FIXTURE_DIR,
      url
        .split('/')
        .at(-1)!
        .replace(/\.bz2$/, ''),
    )
    if (await Bun.file(target).exists()) return console.log(`✓ ${target}`)

    const response = await fetch(url)
    if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`)

    // Bun has no bzip2 codec; stream through the system binary.
    const bunzip = Bun.spawn(['bunzip2', '-c'], { stdin: response.body, stdout: 'pipe' })
    await Bun.write(`${target}.part`, new Response(bunzip.stdout))
    if ((await bunzip.exited) !== 0) throw new Error(`${url}: bunzip2 failed`)
    await Bun.write(target, Bun.file(`${target}.part`))
    await Bun.file(`${target}.part`).delete()
    console.log(`↓ ${target}`)
  }),
)
