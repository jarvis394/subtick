import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { recordersQuery } from '@/lib/admin'
import { meQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

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
  { to: '/admin/steam-accounts', label: 'Steam accounts' },
  { to: '/admin/users', label: 'Users' },
] as const

function AdminLayout() {
  // Polled anyway by the recorders page; here it flags a sign-in waiting for a code on any tab.
  const { data: recorders } = useQuery(recordersQuery)
  const needsCode = recorders?.some((r) => r.online && r.state === 'needs_guard_code')

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="grid gap-4">
        <h1 className="font-serif text-3xl tracking-tight">Manage instance</h1>
        <nav className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                '-mb-px border-b-2 border-transparent px-3 pb-2.5 text-sm whitespace-nowrap text-muted outline-none',
                'transition-colors hover:text-foreground focus-visible:text-foreground',
                'data-[status=active]:border-accent data-[status=active]:text-foreground',
              )}
            >
              {tab.label}
              {tab.to === '/admin/recorders' && needsCode && (
                <span
                  className="ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-danger"
                  title="A recorder needs a Steam Guard code"
                />
              )}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
