import {
  type HighlightKind,
  KILL_TAGS,
  type KillTag,
  MOMENT_TAGS,
  type MomentTag,
} from '@subtick/domain'
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

export const KILL_TAG_LABEL: Record<KillTag, string> = {
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
  knife: 'Knife',
  taser: 'Zeus',
  grenade: 'Grenade',
}

/** Tags that summaries leave out: the kind badge or the title already says them. */
const UNSUMMARIZED = new Set<KillTag>(['knife', 'taser', 'grenade'])

export const MOMENT_TAG_LABEL: Record<MomentTag, string> = {
  opening: 'Opening kill',
  pistol_round: 'Pistol round',
  match_point: 'Match point',
  overtime: 'Overtime',
  last_round: 'Last round',
  defuse: 'Defuse',
  ninja_defuse: 'Ninja defuse',
}

/** A hue per kind, from the profile's party chart; the commonest kinds have none. */
export const KIND_TONE: Partial<
  Record<HighlightKind, 'tint-orange' | 'tint-violet' | 'tint-sky' | 'tint-teal'>
> = {
  ace: 'tint-orange',
  clutch: 'tint-violet',
  quad: 'tint-sky',
  triple: 'tint-teal',
}

/** Most frequent notable tags across a moment's kills, labelled e.g. "3× HS", "Flick". */
export const tagSummary = (kills: { tags: KillTag[] }[], limit = 3) => {
  const counts = new Map<KillTag, number>()
  for (const tag of kills.flatMap((k) => k.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)

  return [...counts]
    .filter(([tag]) => !UNSUMMARIZED.has(tag))
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, n]) => ({
      tag,
      label: n > 1 ? `${n}× ${KILL_TAG_LABEL[tag]}` : KILL_TAG_LABEL[tag],
    }))
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

/** The filter group a kind falls under. */
export const kindFilterOf = (kind: HighlightKind): KindFilter =>
  KIND_FILTERS.find((f) => (f.kinds as readonly HighlightKind[]).includes(kind))?.id ?? 'all'

/** The clip open in the viewer, as a URL search param on any page that lists clips. */
export const clipViewerSearch = z.object({ clip: z.uuid().optional() })

/** The highlights page's filters and open clip, as URL search params. */
export const clipListSearch = clipViewerSearch.extend({
  kind: z.enum(KIND_FILTERS.map((f) => f.id) as [KindFilter, ...KindFilter[]]).optional(),
  maps: z.array(z.string()).optional(),
  /** Any of these players, the viewer (`me`) or people the viewer played with. */
  players: z.array(z.string()).optional(),
  me: z.boolean().optional(),
  playedWith: z.boolean().optional(),
  tags: z.array(z.enum(KILL_TAGS)).optional(),
  moments: z.array(z.enum(MOMENT_TAGS)).optional(),
  clutch: z.array(z.number().int()).optional(),
})

export type ClipListSearch = z.infer<typeof clipListSearch>

/** Every filter param, cleared: patched over the search to reset the feed. */
export const NO_FILTERS = {
  kind: undefined,
  maps: undefined,
  players: undefined,
  me: undefined,
  playedWith: undefined,
  tags: undefined,
  moments: undefined,
  clutch: undefined,
} satisfies Partial<ClipListSearch>

/** The feed query for the page's search params; `steamId` pins it to one player's profile. */
export const feedFilters = (search: ClipListSearch, steamId?: string) => ({
  kinds: [...KIND_FILTERS.find((f) => f.id === (search.kind ?? 'all'))!.kinds],
  steamId,
  ...(steamId ? {} : { players: search.players, me: search.me, playedWith: search.playedWith }),
  tags: search.tags,
  moments: search.moments,
  maps: search.maps,
  clutch: search.clutch,
})

/** How many values the Filters popover has picked. */
export const detailFilterCount = (search: ClipListSearch) =>
  (search.tags?.length ?? 0) +
  (search.moments?.length ?? 0) +
  (search.maps?.length ?? 0) +
  (search.clutch?.length ?? 0)

/** Toggles one value in a list param, dropping the param once it's empty. */
export const toggled = <T>(list: T[] | undefined, value: T) => {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]

  return next.length ? next : undefined
}

/**
 * Shows a clip opened in a page's viewer as its own `/clips/$id` URL. Unmasked on reload, so a
 * reload or a shared link opens the clip page rather than the page the dialog was over.
 */
export const clipMask = (id: string) =>
  ({ to: '/clips/$id', params: { id }, unmaskOnReload: true }) as const
