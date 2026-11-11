import type { HighlightKind, KillTag, MomentTag } from '@subtick/domain'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { ApiError, api, unwrap } from './api'
import { observeMatches } from './new-matches'
import { clearStoredMe, readStoredMe, writeStoredMe } from './stored-me'

export interface ClipFilters {
  kinds?: HighlightKind[]
  maps?: string[]
  matches?: string[]
  /** One player's plays. */
  steamId?: string
  /** Any of these players, the signed-in user's own plays or those of people they played with. */
  players?: string[]
  me?: boolean
  playedWith?: boolean
  tags?: KillTag[]
  moments?: MomentTag[]
  clutch?: number[]
}

const joined = (list?: (string | number)[]) => list?.join(',') || undefined

const fetchMe = async () => {
  const me = await unwrap(api.me.get()).catch((error: unknown) => {
    if (isSessionError(error)) clearStoredMe()
    throw error
  })
  writeStoredMe(me)

  return me
}

const fetchMatches = async (cursor?: string, limit = 20) => {
  const page = await unwrap(api.matches.get({ query: { cursor, limit } }))
  observeMatches(page.items)

  return page
}

const fetchMatch = (id: string) => unwrap(api.matches({ id }).get())

const fetchClips = (offset: number, filters: ClipFilters) =>
  unwrap(
    api.highlights.get({
      query: {
        offset,
        kinds: joined(filters.kinds),
        maps: joined(filters.maps),
        matches: joined(filters.matches),
        steamId: filters.steamId,
        players: joined(filters.players),
        me: filters.me || undefined,
        playedWith: filters.playedWith || undefined,
        tags: joined(filters.tags),
        moments: joined(filters.moments),
        clutch: joined(filters.clutch),
      },
    }),
  )

const fetchClip = (id: string) => unwrap(api.highlights({ id }).get())
const fetchFacets = (steamId?: string) => unwrap(api.highlights.facets.get({ query: { steamId } }))
const fetchQueue = () => unwrap(api.queue.get())
const fetchPlayer = (steamId: string) => unwrap(api.players({ steamId }).get())

const fetchPlayerMatches = (steamId: string, cursor?: string) =>
  unwrap(api.players({ steamId }).matches.get({ query: { cursor } }))

const fetchSessions = (player: string, cursor?: string, until?: string) =>
  unwrap(api.players({ steamId: player }).sessions.get({ query: { cursor, until } }))

export type Me = Awaited<ReturnType<typeof fetchMe>>
export type MatchListItem = Awaited<ReturnType<typeof fetchMatches>>['items'][number]
export type MatchDetail = Awaited<ReturnType<typeof fetchMatch>>
export type Clip = Awaited<ReturnType<typeof fetchClips>>['items'][number]
export type ClipFacets = Awaited<ReturnType<typeof fetchFacets>>
export type QueueItem = Awaited<ReturnType<typeof fetchQueue>>['items'][number]
export type Player = Awaited<ReturnType<typeof fetchPlayer>>
export type Session = Awaited<ReturnType<typeof fetchSessions>>['items'][number]
export type SessionPlayer = Session['players'][number]

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

/** One recorded clip, for opening the viewer straight from a link. */
export const clipQuery = (id: string) =>
  queryOptions({
    queryKey: ['highlights', 'clip', id],
    queryFn: () => fetchClip(id),
  })

/** What the feed's filters can offer, for everyone's clips or one player's. */
export const clipFacetsQuery = (steamId?: string) =>
  queryOptions({
    queryKey: ['highlights', 'facets', steamId ?? null],
    queryFn: () => fetchFacets(steamId),
  })

/**
 * The instance's pipeline work. Status changes refetch it over SSE; meanwhile it polls, faster
 * while there's work, so stages that don't stream progress still move.
 */
export const queueQuery = queryOptions({
  queryKey: ['queue'],
  queryFn: fetchQueue,
  refetchInterval: (query) => (query.state.data?.items.length ? 4000 : 30_000),
})

/** Everything a profile shows but its match list and clips, so switching tabs never loads. */
export const playerQuery = (steamId: string) =>
  queryOptions({ queryKey: ['player', steamId], queryFn: () => fetchPlayer(steamId) })

/** `until` makes the first page reach back to that date, for opening on an older session. */
export const sessionsQuery = (player: string, until?: string) =>
  infiniteQueryOptions({
    queryKey: ['player', player, 'sessions', until ?? null],
    queryFn: ({ pageParam }) => fetchSessions(player, pageParam, pageParam ? undefined : until),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

export const playerMatchesQuery = (steamId: string) =>
  infiniteQueryOptions({
    queryKey: ['player', steamId, 'matches'],
    queryFn: ({ pageParam }) => fetchPlayerMatches(steamId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
