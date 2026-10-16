import type { HighlightKind } from '@subtick/domain'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

export interface ClipFilters {
  kinds?: HighlightKind[]
  map?: string
}

const fetchMe = () => unwrap(api.me.get())
const fetchMatches = (cursor?: string, limit = 20) =>
  unwrap(api.matches.get({ query: { cursor, limit } }))
const fetchMatch = (id: string) => unwrap(api.matches({ id }).get())
const fetchClips = (offset: number, filters: ClipFilters) =>
  unwrap(
    api.highlights.get({
      query: { offset, kinds: filters.kinds?.join(',') || undefined, map: filters.map },
    }),
  )
const fetchFacets = () => unwrap(api.highlights.facets.get())

export type Me = Awaited<ReturnType<typeof fetchMe>>
export type MatchListItem = Awaited<ReturnType<typeof fetchMatches>>['items'][number]
export type MatchDetail = Awaited<ReturnType<typeof fetchMatch>>
export type Clip = Awaited<ReturnType<typeof fetchClips>>['items'][number]

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: fetchMe, staleTime: 30_000 })

export const matchesQuery = infiniteQueryOptions({
  queryKey: ['matches'],
  queryFn: ({ pageParam }) => fetchMatches(pageParam),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (page) => page.nextCursor ?? undefined,
})

/** The sidebar's "Recent" list. */
export const recentMatchesQuery = queryOptions({
  queryKey: ['matches', 'recent'],
  queryFn: () => fetchMatches(undefined, 10),
})

export const matchQuery = (id: string) =>
  queryOptions({ queryKey: ['match', id], queryFn: () => fetchMatch(id) })

/** Recorded clips only, newest match first. */
export const clipsQuery = (filters: ClipFilters) =>
  infiniteQueryOptions({
    queryKey: ['highlights', 'clips', filters],
    queryFn: ({ pageParam }) => fetchClips(pageParam, filters),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  })

export const clipFacetsQuery = queryOptions({
  queryKey: ['highlights', 'facets'],
  queryFn: fetchFacets,
})
