/* oxlint-disable no-await-in-loop -- one page at a time is polite to the wiki */
/**
 * Downloads each map's preview image (first infobox image) and logo from the Counter-Strike
 * Fandom wiki into src/assets/maps/. Re-run to refresh; existing files are overwritten.
 *   bun scripts/fetch-map-assets.ts
 */
import { mkdir } from 'node:fs/promises'

const WIKI = 'https://counterstrike.fandom.com/api.php'
const OUT = new URL('../src/assets/maps/', import.meta.url).pathname
// Fandom's image CDN serves WebP for every source format.
const PREVIEW_WIDTH = 800
const LOGO_WIDTH = 160

/** Map id → wiki page title. */
const MAPS: Record<string, string> = {
  de_ancient: 'Ancient',
  de_anubis: 'Anubis',
  de_dust2: 'Dust II',
  de_inferno: 'Inferno',
  de_mirage: 'Mirage',
  de_nuke: 'Nuke',
  de_overpass: 'Overpass',
  de_train: 'Train',
  de_vertigo: 'Vertigo',
  cs_italy: 'Italy',
  cs_office: 'Office',
}

const headers = { 'user-agent': 'subtick-asset-fetcher/1.0 (personal, non-commercial)' }

/** Infobox tab label → original image URL (without the size/revision suffix). */
const infoboxImages = (html: string) => {
  const infobox = html.slice(html.indexOf('portable-infobox'))
  const labels = [...infobox.matchAll(/wds-tabs__tab-label">\s*([^<\s][^<]*?)\s*</g)].map(
    (m) => m[1]!,
  )
  const images = [
    ...infobox.matchAll(/<figure class="pi-item pi-image">\s*<a href="([^"]+)"/g),
  ].map((m) => m[1]!.replace(/\/revision\/.*$/, ''))
  // A single image has no tabs.
  return labels.length
    ? Object.fromEntries(labels.map((label, i) => [label, images[i]]))
    : { Image: images[0] }
}

const download = async (url: string, path: string) => {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const bytes = await Bun.write(path, response)
  return bytes
}

await mkdir(`${OUT}preview`, { recursive: true })

for (const [id, page] of Object.entries(MAPS)) {
  const params = new URLSearchParams({
    action: 'parse',
    page,
    prop: 'text',
    section: '0',
    format: 'json',
    redirects: '1',
  })
  const json = (await (await fetch(`${WIKI}?${params}`, { headers })).json()) as {
    parse?: { text: { '*': string } }
  }
  if (!json.parse) {
    console.warn(`✗ ${id}: page "${page}" not found`)
    continue
  }
  const images = infoboxImages(json.parse.text['*'])
  const preview = images.Image
  const logo = images.Logo ?? images.Icon

  if (preview) {
    const size = await download(
      `${preview}/revision/latest/scale-to-width-down/${PREVIEW_WIDTH}`,
      `${OUT}preview/${id}.webp`,
    )
    console.log(`✓ ${id} preview ${(size / 1024).toFixed(0)} KB`)
  } else console.warn(`✗ ${id}: no preview image`)

  if (logo) {
    const size = await download(
      `${logo}/revision/latest/scale-to-width-down/${LOGO_WIDTH}`,
      `${OUT}${id}.webp`,
    )
    console.log(`✓ ${id} logo ${(size / 1024).toFixed(0)} KB`)
  } else console.warn(`✗ ${id}: no logo`)
}
