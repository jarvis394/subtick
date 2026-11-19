import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { PendingNotice } from '@/components/pending-approval'
import { Button } from '@/components/ui/button'
import { useSwitchAccount } from '@/hooks/use-accounts'
import { authClient } from '@/lib/auth'
import { type Account, accountsQuery } from '@/lib/queries'

/**
 * The /pending page's wait, for an account signed in beside the active one: a way to sign it out
 * while it waits, and to switch to it once an admin approves it.
 */
export const PendingAccount = ({ account, onDone }: { account: Account; onDone: () => void }) => {
  const queryClient = useQueryClient()
  const { switchTo, target } = useSwitchAccount()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await authClient.multiSession.revoke({ sessionToken: account.sessionToken })
    await queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey })
    setSigningOut(false)
    onDone()
  }

  const open = async () => {
    await switchTo(account)
    onDone()
  }

  return (
    <PendingNotice
      name={account.name}
      email={account.email}
      approved={!account.pending}
      next="You can switch to this account once they do"
      action={
        account.pending ? (
          <Button
            size="sm"
            variant="ghost"
            tone="danger"
            loading={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut />
            Sign out
          </Button>
        ) : (
          <Button size="sm" variant="primary" loading={target !== null} onClick={() => void open()}>
            <ArrowLeftRight />
            Switch
          </Button>
        )
      }
    />
  )
}
