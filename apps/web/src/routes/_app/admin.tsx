import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
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
  { to: '/admin/users', label: 'Users' },
] as const

function AdminLayout() {
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
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
