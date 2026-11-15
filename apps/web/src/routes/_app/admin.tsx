import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { RecorderHealthBanner } from '@/components/recorder-health-banner'
import { Tab, Tabs, TabsList } from '@/components/ui/tabs'
import { recordersQuery } from '@/lib/admin'
import { meQuery } from '@/lib/queries'

/** Instance administration; only for users with the admin role (the api enforces it too). */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me.user.isAdmin) throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

const TABS = [
  { to: '/admin/recorders', label: 'Recorders' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/storage', label: 'Storage' },
] as const

function AdminLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const active = TABS.find((tab) => pathname.startsWith(tab.to))?.to ?? null
  const recorders = useQuery(recordersQuery).data
  const fleet = recorders && {
    registered: recorders.length,
    healthy: recorders.filter((r) => r.health === 'healthy').length,
    failing: recorders.filter((r) => r.health === 'failing').length,
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-display tracking-tight">Manage instance</h1>
        {/* Each tab is a link to its page. */}
        <Tabs value={active} className="max-w-full min-w-0">
          <TabsList aria-label="Sections">
            {TABS.map((tab) => (
              <Tab
                key={tab.to}
                value={tab.to}
                nativeButton={false}
                // Only the indicator moves; the page under it swaps without a transition.
                render={<Link to={tab.to} viewTransition={false} />}
              >
                {tab.label}
              </Tab>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <RecorderHealthBanner fleet={fleet} manageLink={active !== '/admin/recorders'} />
      <Outlet />
    </div>
  )
}
