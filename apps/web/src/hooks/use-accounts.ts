import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLeave } from '@/hooks/use-sign-out'
import { authClient } from '@/lib/auth'
import { type Account, accountsQuery } from '@/lib/queries'

/** The accounts signed in to this browser; empty until they load. */
export const useAccounts = () => useQuery(accountsQuery).data ?? []

/**
 * Switches the active account in place: the session cookie changes, then every query refetches
 * behind what's on screen, so the page swaps to the new account's data without a blank state.
 * `target` is the account being switched to, so its avatar can light up before the swap lands.
 */
export const useSwitchAccount = () => {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<string | null>(null)

  const switchTo = async (account: Account) => {
    if (account.active || target) return
    setTarget(account.id)
    const { error } = await authClient.multiSession.setActive({
      sessionToken: account.sessionToken,
    })
    if (error) {
      setTarget(null)
      await queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey })

      return
    }
    queryClient.setQueryData(accountsQuery.queryKey, (list) =>
      list?.map((a) => ({ ...a, active: a.id === account.id })),
    )
    await queryClient.invalidateQueries()
    setTarget(null)
  }

  return { switchTo, target }
}

/**
 * Once the active account is gone (deleted), makes the next signed-in account active, oldest
 * first like signing out does, and stays on the page. Leaves for the sign-in page only when no
 * account is left. Deleting clears just the active session cookie, so the others still switch.
 */
export const useNextAccount = () => {
  const queryClient = useQueryClient()
  const leave = useLeave()

  return async (goneId: string) => {
    const { data } = await authClient.multiSession.listDeviceSessions()
    const next = (data ?? [])
      .filter((s) => s.user.id !== goneId)
      .toSorted((a, b) => +new Date(a.session.createdAt) - +new Date(b.session.createdAt))[0]
    const switched =
      next && !(await authClient.multiSession.setActive({ sessionToken: next.session.token })).error
    if (!switched) return leave()
    queryClient.setQueryData(accountsQuery.queryKey, (list) =>
      list?.filter((a) => a.id !== goneId).map((a) => ({ ...a, active: a.id === next.user.id })),
    )
    await queryClient.invalidateQueries()
  }
}

/**
 * Signs out of the active account only. With another account still signed in, the server makes
 * it active and the app stays; otherwise it leaves for the sign-in page.
 */
export const useSignOut = () => {
  const queryClient = useQueryClient()
  const leave = useLeave()

  return async () => {
    const accounts = await queryClient.fetchQuery(accountsQuery).catch(() => [])
    const active = accounts.find((a) => a.active)
    if (!active || accounts.length < 2) {
      await authClient.signOut()
      await leave()

      return
    }
    await authClient.multiSession.revoke({ sessionToken: active.sessionToken })
    await queryClient.invalidateQueries()
  }
}
