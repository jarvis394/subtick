import { isPlaceholderEmail } from '@subtick/domain'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Check, Hourglass, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { useSignOut } from '@/hooks/use-accounts'
import { meQuery } from '@/lib/queries'

/** How often a waiting account checks whether it was let in. */
export const RECHECK_MS = 30_000

/**
 * Who is waiting and why, over who is signed in and the action that fits: the /pending page and
 * the account dialog both show it. `next` says what happens once an admin approves.
 */
export const PendingNotice = ({
  name,
  email,
  approved = false,
  next,
  action,
}: {
  name: string
  email: string | null
  approved?: boolean
  next: string
  action: ReactNode
}) => {
  const Icon = approved ? Check : Hourglass

  return (
    <div role="status" className="grid w-full gap-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0">
          <p className="font-medium">{approved ? 'You’re in' : 'Sign-up pending approval'}</p>
          <p className="mt-1 text-body text-muted">
            {approved ? (
              'An admin approved this account. Switch to it to link Steam and see highlights.'
            ) : (
              <>
                subtick is invite-only. An admin needs to let you in before you can link Steam and
                see highlights. {next}
                {email ? <>, and we’ll email {email}</> : null}.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="min-w-0 truncate text-small text-muted">
          Signed in as <span className="text-foreground">{name}</span>
        </p>
        {action}
      </div>
    </div>
  )
}

/**
 * What an account sees until an admin approves it, when no approved account is signed in beside
 * it: nothing of the app, only who is signed in and a way out. `/me` is re-checked in the
 * background, so approval opens the app on its own.
 */
export const PendingApproval = () => {
  const { data: me } = useSuspenseQuery({ ...meQuery, refetchInterval: RECHECK_MS })
  const signOut = useSignOut()

  if (!me.user.pending) return <Navigate to="/" />

  return (
    <AuthFrame>
      <Wordmark className="text-hero" />
      <div className="w-full rounded-[28px] border p-6">
        <PendingNotice
          name={me.user.name}
          email={isPlaceholderEmail(me.user.email) ? null : me.user.email}
          next="This page opens the app as soon as they do"
          action={
            <Button size="sm" variant="ghost" tone="danger" onClick={() => void signOut()}>
              <LogOut />
              Sign out
            </Button>
          }
        />
      </div>
    </AuthFrame>
  )
}
