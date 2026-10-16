import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { ApiError } from '@/lib/api'
import { meQuery } from '@/lib/queries'

/** Signed-in area. Without a session → /login; without match history access → /setup. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: location.href } })
      }
      throw error
    })
    const ready = me.steamLinks.some((link) => link.hasMatchAuth)
    if (!ready && location.pathname !== '/setup' && location.pathname !== '/settings') {
      throw redirect({ to: '/setup' })
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
