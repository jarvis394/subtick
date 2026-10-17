/**
 * Downloads the CS2 skill group icons (matchmaking0–18, 200×80 PNG; 0 = unranked) from Leetify
 * into public/ranks/. Competitive and Wingman share them. Re-run to refresh; files are overwritten.
 *   bun scripts/fetch-rank-icons.ts
 */
import { mkdir } from 'node:fs/promises'

const BASE = 'https://leetify.com/assets/images/rank-icons/'
const OUT = new URL('../public/ranks/', import.meta.url).pathname

const headers = { 'user-agent': 'subtick-asset-fetcher/1.0 (personal, non-commercial)' }

await mkdir(OUT, { recursive: true })
await Promise.all(
  Array.from({ length: 19 }, async (_, group) => {
    const name = `matchmaking${group}.png`
    const response = await fetch(BASE + name, { headers })
    if (!response.ok || response.headers.get('content-type') !== 'image/png')
      throw new Error(`${name}: HTTP ${response.status} ${response.headers.get('content-type')}`)
    await Bun.write(OUT + `${group}.png`, response)
  }),
)
