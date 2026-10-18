import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

const fetchRecorders = () => unwrap(api.admin.recorders.get())
const fetchUsers = () => unwrap(api.admin.users.get())
const fetchStorage = () => unwrap(api.admin.storage.get())

export type AdminRecorder = Awaited<ReturnType<typeof fetchRecorders>>[number]
export type AdminUser = Awaited<ReturnType<typeof fetchUsers>>[number]
export type StorageReport = Awaited<ReturnType<typeof fetchStorage>>

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
