import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

const fetchRecorders = () => unwrap(api.admin.recorders.get())
const fetchUsers = () => unwrap(api.admin.users.get())
const fetchStorage = () => unwrap(api.admin.storage.get())
const fetchStoredHighlights = () => unwrap(api.admin.storage.highlights.get())
const fetchStoredMatches = () => unwrap(api.admin.storage.matches.get())

export type AdminRecorder = Awaited<ReturnType<typeof fetchRecorders>>[number]
export type AdminUser = Awaited<ReturnType<typeof fetchUsers>>[number]
export type StorageReport = Awaited<ReturnType<typeof fetchStorage>>
export type StoredHighlight = Awaited<ReturnType<typeof fetchStoredHighlights>>[number]
export type StoredMatch = Awaited<ReturnType<typeof fetchStoredMatches>>[number]

/** Polled: machines report every 15 s. */
export const recordersQuery = queryOptions({
  queryKey: ['admin', 'recorders'],
  queryFn: fetchRecorders,
  refetchInterval: 5000,
})

export const usersQuery = queryOptions({ queryKey: ['admin', 'users'], queryFn: fetchUsers })

/** The api reuses a report for 30 s, so refetching faster gains nothing. */
export const storageQuery = queryOptions({
  queryKey: ['admin', 'storage'],
  queryFn: fetchStorage,
  refetchInterval: 30_000,
})

/** Sizes come from the same 30 s report, so these refetch with it. */
export const storedHighlightsQuery = queryOptions({
  queryKey: ['admin', 'storage', 'highlights'],
  queryFn: fetchStoredHighlights,
  refetchInterval: 30_000,
})

export const storedMatchesQuery = queryOptions({
  queryKey: ['admin', 'storage', 'matches'],
  queryFn: fetchStoredMatches,
  refetchInterval: 30_000,
})
