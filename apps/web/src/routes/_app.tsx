import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { ApiError } from '@/lib/api'
import { meQuery } from '@/lib/queries'
import { isSetUp, setupSkipped } from '@/lib/setup'

/**
 * Signed-in area. Without a session → /login; without match history access → /setup (except for
 * settings and admin pages, or once the user skipped setup in this browser).
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient
      .ensureQueryData({ ...meQuery, revalidateIfStale: true })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          throw redirect({ to: '/login', search: { redirect: location.href } })
        }
        throw error
      })
    // Admin pages don't need the admin's own match history.
    const exempt =
      location.pathname === '/setup' ||
      location.pathname === '/settings' ||
      (me.user.isAdmin && location.pathname.startsWith('/admin'))
    if (!isSetUp(me) && !exempt && !setupSkipped()) {
      throw redirect({ to: '/setup' })
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
