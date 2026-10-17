import type { HighlightKind } from '@subtick/domain'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { ApiError, api, unwrap } from './api'
import { clearStoredMe, readStoredMe, writeStoredMe } from './stored-me'

export interface ClipFilters {
  kinds?: HighlightKind[]
  map?: string
}

const fetchMe = async () => {
  const me = await unwrap(api.me.get()).catch((error: unknown) => {
    if (isSessionError(error)) clearStoredMe()
    throw error
  })
  writeStoredMe(me)
  return me
}
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

/** `/me` answering 401 (no session) or 403 (rejected) means the stored session is no good. */
export const isSessionError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: fetchMe,
  staleTime: 30_000,
  // The last known user renders the app straight away; epoch 0 marks it stale so it revalidates.
  initialData: readStoredMe,
  initialDataUpdatedAt: 0,
})

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
