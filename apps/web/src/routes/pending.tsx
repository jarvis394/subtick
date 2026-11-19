import { createFileRoute, redirect } from '@tanstack/react-router'
import { PendingApproval } from '@/components/pending-approval'
import { leavePendingAccount, showPendingAccount } from '@/lib/pending-account'
import { requireMe } from '@/lib/auth-route'

/**
 * Signed in, waiting for an admin. Signed out → /login; approved, or another approved account
 * signed in here → the app (which shows the wait in its account dialog).
 */
export const Route = createFileRoute('/pending')({
  head: () => ({ meta: [{ title: 'Waiting for approval · subtick' }] }),
  beforeLoad: async ({ context }) => {
    const me = await requireMe(context.queryClient)
    if (!me.user.pending) throw redirect({ to: '/' })
    const left = await leavePendingAccount(context.queryClient)
    if (left) {
      showPendingAccount(left)
      throw redirect({ to: '/' })
    }
  },
  component: PendingApproval,
})
