/**
 * Downloads CS2 killfeed icons (weapons and kill modifiers) from lexogrine/cs2-react-hud (MIT)
 * into src/assets/killfeed/. Re-run to refresh; existing files are overwritten.
 *   bun scripts/fetch-killfeed-icons.ts
 */
import { mkdir } from 'node:fs/promises'

const REPO = 'lexogrine/cs2-react-hud'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`
const OUT = new URL('../src/assets/killfeed/', import.meta.url).pathname

/** Kill modifier icons: source file → our name (a KillTag where one fits). */
const MODIFIERS: Record<string, string> = {
  'src/assets/images/headshot.svg': 'headshot',
  'src/assets/images/wallbang.svg': 'wallbang',
  'src/assets/images/noscope.svg': 'noscope',
  'src/assets/images/smoke_kill.svg': 'smoke',
  'src/assets/images/flashed_kill.svg': 'blind',
  'src/assets/images/icon_skull_default.svg': 'skull',
}

const headers = { 'user-agent': 'subtick-asset-fetcher/1.0 (personal, non-commercial)' }

const tree = (await (
  await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, { headers })
).json()) as { tree: { path: string }[] }
const weapons = tree.tree
  .map((e) => e.path)
  .filter((p) => p.startsWith('src/assets/weapons/') && p.endsWith('.svg'))

const files = [
  ...Object.entries(MODIFIERS).map(([src, name]) => [src, `${name}.svg`] as const),
  ...weapons.map((src) => [src, `weapons/${src.split('/').at(-1)!}`] as const),
]

await mkdir(`${OUT}weapons`, { recursive: true })
await Promise.all(
  files.map(async ([src, dest]) => {
    const response = await fetch(RAW + src, { headers })
    if (!response.ok) throw new Error(`${src}: HTTP ${response.status}`)
    const svg = await response.text()
    // A few grenades have no fill and would render black; the killfeed is white on dark.
    await Bun.write(
      OUT + dest,
      /<svg[^>]*\sfill=/.test(svg) ? svg : svg.replace('<svg', '<svg fill="white"'),
    )
  }),
)
console.log(`✓ ${files.length} icons → src/assets/killfeed/`)
