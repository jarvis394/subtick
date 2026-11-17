import { isPlaceholderEmail } from '@subtick/domain'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Hourglass, LogOut } from 'lucide-react'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { useSignOut } from '@/hooks/use-sign-out'
import { meQuery } from '@/lib/queries'

/** How often a waiting account checks whether it was let in. */
const RECHECK_MS = 30_000

/**
 * What an account sees until an admin approves it: nothing of the app, only who is signed in and
 * a way out. `/me` is re-checked in the background, so approval opens the app on its own.
 */
export const PendingApproval = () => {
  const { data: me } = useSuspenseQuery({ ...meQuery, refetchInterval: RECHECK_MS })
  const signOut = useSignOut()
  const email = isPlaceholderEmail(me.user.email) ? null : me.user.email

  if (!me.user.pending) return <Navigate to="/" />

  return (
    <AuthFrame>
      <Wordmark className="text-hero" />
      <div role="status" className="grid w-full gap-4 rounded-[28px] border p-6">
        <div className="flex gap-3">
          <Hourglass className="mt-0.5 size-4 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="font-medium">Sign-up pending approval</p>
            <p className="mt-1 text-body text-muted">
              subtick is invite-only. An admin needs to let you in before you can link Steam and see
              highlights. This page opens the app as soon as they do
              {email ? <>, and we’ll email {email}</> : null}.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="min-w-0 truncate text-small text-muted">
            Signed in as <span className="text-foreground">{me.user.name}</span>
          </p>
          <Button size="sm" variant="ghost" tone="danger" onClick={signOut}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
    </AuthFrame>
  )
}
