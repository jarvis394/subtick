import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

const fetchRecorders = () => unwrap(api.admin.recorders.get())
const fetchSteamAccounts = () => unwrap(api.admin['steam-accounts'].get())
const fetchUsers = () => unwrap(api.admin.users.get())

export type AdminRecorder = Awaited<ReturnType<typeof fetchRecorders>>[number]
export type AdminSteamAccount = Awaited<ReturnType<typeof fetchSteamAccounts>>[number]
export type AdminUser = Awaited<ReturnType<typeof fetchUsers>>[number]

/** Polled: machines report every 15 s, and an admin may be waiting on a sign-in. */
export const recordersQuery = queryOptions({
  queryKey: ['admin', 'recorders'],
  queryFn: fetchRecorders,
  refetchInterval: 5000,
})

export const steamAccountsQuery = queryOptions({
  queryKey: ['admin', 'steam-accounts'],
  queryFn: fetchSteamAccounts,
})

export const usersQuery = queryOptions({ queryKey: ['admin', 'users'], queryFn: fetchUsers })
