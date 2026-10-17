import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

const fetchRecorders = () => unwrap(api.admin.recorders.get())
const fetchSteamAccounts = () => unwrap(api.admin['steam-accounts'].get())
const fetchUsers = () => unwrap(api.admin.users.get())

export type AdminRecorder = Awaited<ReturnType<typeof fetchRecorders>>[number]
export type AdminSteamAccount = Awaited<ReturnType<typeof fetchSteamAccounts>>[number]
export type AdminUser = Awaited<ReturnType<typeof fetchUsers>>[number]

/**
 * Polled: machines report every 15 s. During a sign-in they report every few seconds and an admin
 * is watching for the code to go through, so poll faster then.
 */
export const recordersQuery = queryOptions({
  queryKey: ['admin', 'recorders'],
  queryFn: fetchRecorders,
  refetchInterval: (query) =>
    query.state.data?.some(
      (r) => r.online && (r.state === 'signing_in' || r.state === 'needs_guard_code'),
    )
      ? 1500
      : 5000,
})

export const steamAccountsQuery = queryOptions({
  queryKey: ['admin', 'steam-accounts'],
  queryFn: fetchSteamAccounts,
})

export const usersQuery = queryOptions({ queryKey: ['admin', 'users'], queryFn: fetchUsers })
