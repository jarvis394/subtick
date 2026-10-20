import { Tabs } from '@base-ui/react/tabs'
import { Link, Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
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

/** Same switcher as Yours / Everyone on a match page; each tab is a link to its page. */
const tabClass =
  'relative z-10 flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm whitespace-nowrap text-muted transition-colors outline-none select-none hover:text-foreground data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

function AdminLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const active = TABS.find((tab) => pathname.startsWith(tab.to))?.to ?? null

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl tracking-tight">Manage instance</h1>
        <Tabs.Root value={active}>
          <Tabs.List className="relative flex gap-1" aria-label="Sections">
            {TABS.map((tab) => (
              <Tabs.Tab
                key={tab.to}
                value={tab.to}
                className={tabClass}
                nativeButton={false}
                // Only the indicator moves; the page under it swaps without a transition.
                render={<Link to={tab.to} viewTransition={false} />}
              >
                {tab.label}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator className="absolute top-0 left-0 z-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-lg bg-surface-2 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
          </Tabs.List>
        </Tabs.Root>
      </div>
      <Outlet />
    </div>
  )
}
