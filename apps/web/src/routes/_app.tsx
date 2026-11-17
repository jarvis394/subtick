import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { requireMe } from '@/lib/auth-route'
import { meQuery } from '@/lib/queries'
import { isSetUp, setupSkipped } from '@/lib/setup'

/**
 * Signed-in area. Without a session → /login; awaiting approval → /pending; without
 * match history access → /setup (except for settings and admin pages, or once the user skipped
 * setup in this browser).
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await requireMe(context.queryClient, location.href)
    if (me.user.pending) throw redirect({ to: '/pending' })
    // Admin pages don't need the admin's own match history.
    const exempt =
      location.pathname === '/setup' ||
      location.pathname === '/settings' ||
      (me.user.isAdmin && location.pathname.startsWith('/admin'))
    if (!isSetUp(me) && !exempt && !setupSkipped()) {
      throw redirect({ to: '/setup' })
    }
  },
  component: AppLayout,
})

/** A /me answer that turns out pending (a stale stored hint, or a 403 refetching it) leaves the app. */
function AppLayout() {
  const { data: me } = useQuery(meQuery)

  if (me?.user.pending) return <Navigate to="/pending" />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
