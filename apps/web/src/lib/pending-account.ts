import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { authClient } from '@/lib/auth'
import { accountsQuery, meQuery } from '@/lib/queries'

/**
 * An account awaiting approval never stays the active one while an approved account is signed in
 * beside it: this switches to that one (`preferId` first). Resolves to the id of the account it
 * left, or null when it had nothing to do or nowhere to go.
 */
export const leavePendingAccount = async (queryClient: QueryClient, preferId?: string) => {
  const accounts = await queryClient.fetchQuery({ ...accountsQuery, staleTime: 0 }).catch(() => [])
  const active = accounts.find((a) => a.active)
  if (!active?.pending) return null
  const approved = accounts.filter((a) => !a.pending)
  const next = approved.find((a) => a.id === preferId) ?? approved[0]
  if (!next) return null
  const { error } = await authClient.multiSession.setActive({ sessionToken: next.sessionToken })
  if (error) return null
  queryClient.setQueryData(
    accountsQuery.queryKey,
    accounts.map((a) => ({ ...a, active: a.id === next.id })),
  )
  await queryClient.invalidateQueries()
  // Guards read `me` from the cache; a stale pending one would send them straight back here.
  await queryClient.fetchQuery({ ...meQuery, staleTime: 0 })

  return active.id
}

/**
 * The account a page load switched away from (back from Steam, or a confirmation link), shown in
 * a dialog over the app. The id outlives `open`, so the dialog keeps its content while it fades.
 */
let notice: { open: boolean; accountId: string | null } = { open: false, accountId: null }
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

const commit = (next: typeof notice) => {
  notice = next
  listeners.forEach((listener) => listener())
}

export const showPendingAccount = (accountId: string) => commit({ open: true, accountId })

export const dismissPendingAccount = () => commit({ ...notice, open: false })

export const usePendingAccountNotice = () => useSyncExternalStore(subscribe, () => notice)
