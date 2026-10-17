import type { HighlightKind, KillTag } from '@subtick/domain'
import { z } from 'zod'

export const KIND_LABEL: Record<HighlightKind, string> = {
  ace: 'Ace',
  clutch: 'Clutch',
  quad: '4K',
  triple: '3K',
  collateral: 'Collat',
  double: '2K',
  special: 'Special',
  single: 'Kill',
}

const TAG_LABEL: Partial<Record<KillTag, string>> = {
  headshot: 'HS',
  wallbang: 'Wallbang',
  smoke: 'Smoke',
  noscope: 'No-scope',
  blind: 'Blind',
  airborne: 'Mid-air',
  flick: 'Flick',
  long_shot: 'Long',
  collateral: 'Collat',
  low_hp: 'Low HP',
  eco: 'Eco',
}

/** Most frequent notable tags across a moment's kills, e.g. ["3× HS", "Flick"]. */
export const tagSummary = (kills: { tags: KillTag[] }[], limit = 3) => {
  const counts = new Map<KillTag, number>()
  for (const tag of kills.flatMap((k) => k.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts]
    .filter(([tag]) => TAG_LABEL[tag])
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, n]) => (n > 1 ? `${n}× ${TAG_LABEL[tag]}` : TAG_LABEL[tag]!))
}

/** Filter groups on the highlights page. */
export const KIND_FILTERS = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'aces', label: 'Aces', kinds: ['ace'] },
  { id: 'clutches', label: 'Clutches', kinds: ['clutch'] },
  { id: 'multi', label: 'Multi-kills', kinds: ['quad', 'triple', 'double'] },
  { id: 'special', label: 'Special', kinds: ['special', 'collateral', 'single'] },
] as const satisfies { id: string; label: string; kinds: readonly HighlightKind[] }[]
export type KindFilter = (typeof KIND_FILTERS)[number]['id']

/** The clip open in the viewer, as a URL search param on any page that lists clips. */
export const clipViewerSearch = z.object({ clip: z.uuid().optional() })

/** The highlights page's filters and open clip, as URL search params. */
export const clipListSearch = clipViewerSearch.extend({
  kind: z.enum(KIND_FILTERS.map((f) => f.id) as [KindFilter, ...KindFilter[]]).optional(),
  map: z.string().optional(),
  mine: z.boolean().optional(),
})

/**
 * Shows a clip opened in a page's viewer as its own `/clips/$id` URL. Unmasked on reload, so a
 * reload or a shared link opens the clip page rather than the page the dialog was over.
 */
export const clipMask = (id: string) =>
  ({ to: '/clips/$id', params: { id }, unmaskOnReload: true }) as const
