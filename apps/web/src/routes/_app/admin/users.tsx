import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { UserRow } from '@/components/admin/user-row'
import { FadeItem, FadeList } from '@/components/ui/presence'
import { Badge, Card, Skeleton } from '@/components/ui/surface'
import { type AdminUser, usersQuery } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/users')({
  head: () => ({ meta: [{ title: 'Users · Admin · subtick' }] }),
  loader: ({ context }) => context.queryClient.prefetchQuery(usersQuery),
  component: UsersPage,
})

function UsersPage() {
  const users = useQuery(usersQuery)
  const all = users.data ?? []
  const waiting = all.filter((user) => user.pending).toReversed()
  const members = all.filter((user) => !user.pending)

  if (users.isPending) return <Skeleton className="h-40" />
  if (users.error) return <p className="text-body text-danger select-text">{users.error.message}</p>

  return (
    // The waiting section leaves with its last row, and Members glides up into its place.
    <div className="grid gap-8">
      <FadeList>
        {waiting.length > 0 && (
          <FadeItem key="waiting">
            <Section
              title="Waiting for approval"
              count={<Badge tone="accent">{waiting.length}</Badge>}
              description="Sign-up is invite-only. New accounts see a waiting screen until you let them in."
              users={waiting}
            />
          </FadeItem>
        )}
        <FadeItem key="members">
          <Section
            title="Members"
            count={<Badge>{members.length}</Badge>}
            description="Admins manage recorders, storage and other users. Removing data here can’t be undone."
            users={members}
          />
        </FadeItem>
      </FadeList>
    </div>
  )
}

function Section({
  title,
  count,
  description,
  users,
}: {
  title: string
  count: ReactNode
  description: string
  users: AdminUser[]
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          {title}
          {count}
        </h2>
        <p className="text-small text-muted">{description}</p>
      </div>
      <Card className="divide-y">
        <FadeList>
          {users.map((user) => (
            <FadeItem key={user.id}>
              <UserRow user={user} />
            </FadeItem>
          ))}
        </FadeList>
      </Card>
    </section>
  )
}
