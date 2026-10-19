import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Card, Skeleton } from '@/components/ui/surface'
import { type AdminUser, usersQuery } from '@/lib/admin'
import { api, unwrap } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { meQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/admin/users')({
  loader: ({ context }) => context.queryClient.prefetchQuery(usersQuery),
  component: UsersPage,
})

function UsersPage() {
  const users = useQuery(usersQuery)
  return (
    <section className="grid gap-4">
      <p className="text-sm text-muted">
        Admins manage recorders, their Steam accounts and other users' roles.
      </p>
      {users.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <Card className="divide-y">
          {users.data?.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </Card>
      )}
    </section>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const { data: me } = useSuspenseQuery(meQuery)
  const queryClient = useQueryClient()
  const setRole = useMutation({
    meta: { inlineError: true },
    mutationFn: (role: AdminUser['role']) =>
      unwrap(api.admin.users({ id: user.id }).patch({ role })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const isMe = user.id === me.user.id
  const admin = user.role === 'admin'

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Avatar src={user.image} name={user.name} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          {user.name}
          {admin && <Badge tone="accent">Admin</Badge>}
          {isMe && <span className="text-[12px] font-normal text-muted">you</span>}
        </p>
        <p className="truncate text-[13px] text-muted">
          {user.email.endsWith('@steam.invalid') ? 'Steam sign-in' : user.email} · joined{' '}
          {timeAgo(user.createdAt)}
        </p>
      </div>
      {!isMe && (
        <Button
          size="sm"
          variant={admin ? 'ghost' : 'secondary'}
          onClick={() => setRole.mutate(admin ? 'user' : 'admin')}
          loading={setRole.isPending}
        >
          {admin ? 'Remove admin' : 'Make admin'}
        </Button>
      )}
      {setRole.error && <p className="w-full text-sm text-danger">{setRole.error.message}</p>}
    </div>
  )
}
