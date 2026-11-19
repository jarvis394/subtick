import { cn } from '@/lib/utils'

const W = 600
const H = 200

/** FNV-1a: a stable 32-bit number from the seed, so a player always gets the same banner. */
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)

  return h >>> 0
}

/** mulberry32: a small seeded PRNG returning [0, 1). */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Rand = () => number
const between = (rand: Rand, min: number, max: number) => min + rand() * (max - min)
const pick = <T,>(rand: Rand, items: readonly T[]) => items[Math.floor(rand() * items.length)]!

/** Stacked wavy lines, like a contour map. */
const waves = (rand: Rand) => {
  const count = Math.round(between(rand, 9, 16))
  const amplitude = between(rand, 8, 26)
  const frequency = between(rand, 1.5, 3.5)
  const phase = rand() * Math.PI * 2
  const drift = between(rand, 0.3, 1.2)

  return Array.from({ length: count }, (_, i) => {
    const y0 = ((i + 0.5) / count) * H * 1.3 - H * 0.15
    const points = Array.from({ length: 41 }, (__, j) => {
      const x = (j / 40) * W
      const y = y0 + Math.sin((j / 40) * Math.PI * frequency + phase + i * drift) * amplitude

      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    return `<polyline points="${points.join(' ')}" fill="none" stroke="white" stroke-opacity="${0.1 + (i % 3) * 0.05}" stroke-width="1.5"/>`
  }).join('')
}

/** A halftone grid: dots grow toward a random corner. */
const halftone = (rand: Rand) => {
  const step = Math.round(between(rand, 14, 22))
  const fx = rand() * W
  const fy = rand() * H
  let dots = ''
  for (let x = step / 2; x < W; x += step) {
    for (let y = step / 2; y < H; y += step) {
      const near = 1 - Math.min(1, Math.hypot(x - fx, y - fy) / (W * 0.7))
      const r = (step / 2) * 0.85 * near
      if (r > 0.6) dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>`
    }
  }

  return `<g fill="white" fill-opacity="0.16">${dots}</g>`
}

/** Diagonal bands of uneven width. */
const stripes = (rand: Rand) => {
  const angle = pick(rand, [-35, -20, 20, 35, 55])
  let bands = ''
  for (let x = -W; x < W * 2;) {
    const width = between(rand, 10, 60)
    if (rand() > 0.45) {
      const opacity = between(rand, 0.05, 0.16)
      bands += `<rect x="${x.toFixed(1)}" y="${-H * 2}" width="${width.toFixed(1)}" height="${H * 5}" fill="white" fill-opacity="${opacity.toFixed(3)}"/>`
    }
    x += width + between(rand, 6, 40)
  }

  return `<g transform="rotate(${angle} ${W / 2} ${H / 2})">${bands}</g>`
}

/** Rings spreading from a point off to one side. */
const rings = (rand: Rand) => {
  const cx = pick(rand, [between(rand, -60, 120), between(rand, W - 120, W + 60)])
  const cy = between(rand, -40, H + 40)
  const gap = between(rand, 14, 26)

  return Array.from({ length: Math.ceil(W / gap) }, (_, i) => {
    const major = i % 4 === 0

    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${((i + 1) * gap).toFixed(1)}" fill="none" stroke="white" stroke-opacity="${major ? 0.22 : 0.09}" stroke-width="${major ? 2 : 1.25}"/>`
  }).join('')
}

const PATTERNS = [waves, halftone, stripes, rings]

const artFor = (seed: string) => {
  const rand = random(hash(seed))
  const hue = Math.floor(rand() * 360)
  const shift = between(rand, 25, 70) * (rand() > 0.5 ? 1 : -1)
  const from = `hsl(${hue} ${between(rand, 25, 40).toFixed(0)}% 40%)`
  const to = `hsl(${(hue + shift + 360) % 360} ${between(rand, 28, 42).toFixed(0)}% 26%)`

  return { from, to, pattern: pick(rand, PATTERNS)(rand) }
}

/**
 * Built once per seed and shown as an image: a pattern can be hundreds of shapes (the halftone's
 * dots), and a page of session cards would otherwise hold thousands of SVG nodes.
 */
const urls = new Map<string, string>()

const bannerUrl = (seed: string) => {
  let url = urls.get(seed)
  if (!url) {
    const art = artFor(seed)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${art.from}"/><stop offset="1" stop-color="${art.to}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${art.pattern}</svg>`
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`
    urls.set(seed, url)
  }

  return url
}

/**
 * A banner for players who haven't uploaded one: a two-hue gradient under a pattern, all chosen
 * from `seed` (their Steam ID), so each player keeps the same one everywhere.
 */
export const GeneratedBanner = ({ seed, className }: { seed: string; className?: string }) => (
  <img
    src={bannerUrl(seed)}
    alt=""
    aria-hidden
    decoding="async"
    className={cn('object-cover', className)}
  />
)
