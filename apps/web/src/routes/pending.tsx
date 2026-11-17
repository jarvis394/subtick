import { createFileRoute, redirect } from '@tanstack/react-router'
import { PendingApproval } from '@/components/pending-approval'
import { requireMe } from '@/lib/auth-route'

/** Signed in, waiting for an admin. Signed out → /login; approved → the app. */
export const Route = createFileRoute('/pending')({
  head: () => ({ meta: [{ title: 'Waiting for approval · subtick' }] }),
  beforeLoad: async ({ context }) => {
    const me = await requireMe(context.queryClient)
    if (!me.user.pending) throw redirect({ to: '/' })
  },
  component: PendingApproval,
})
