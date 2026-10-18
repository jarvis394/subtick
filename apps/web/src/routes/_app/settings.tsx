import { Collapsible } from '@base-ui/react/collapsible'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { z } from 'zod'
import { MatchAuthForm } from '@/components/match-auth-form'
import { SteamIcon } from '@/components/steam-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/surface'
import { ApiError, api, unwrap } from '@/lib/api'
import { authClient, describeAuthError, startSteamFlow } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { type Me, meQuery } from '@/lib/queries'
import { clearStoredMe } from '@/lib/stored-me'

export const Route = createFileRoute('/_app/settings')({
  validateSearch: z.object({ error: z.string().optional() }),
  component: SettingsPage,
})

const linkSteam = () => void startSteamFlow('link', '/settings')

function SettingsPage() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { error } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const steamOnly = me.user.email.endsWith('@steam.invalid')

  return (
    <div className="mx-auto grid max-w-2xl gap-10 @3xl:max-w-5xl">
      <h1 className="font-serif text-3xl tracking-tight">Settings</h1>

      {/* Sections sit side by side once the content area (not the viewport: the sidebar takes
        its share) has room for two readable columns. */}
      <div className="grid gap-10 @3xl:grid-cols-2 @3xl:items-start @3xl:gap-6">
        <Section title="Account">
          <Group>
            <Row
              // Same picture as the sidebar; the initial stands in when there is none.
              leading={
                <Avatar
                  src={me.steamLinks[0]?.avatarUrl ?? me.user.image}
                  name={me.user.name}
                  className="size-9"
                />
              }
              label={me.user.name}
              description={steamOnly ? 'Signed in with Steam' : me.user.email}
            >
              <Button
                size="sm"
                variant="danger-ghost"
                onClick={async () => {
                  await authClient.signOut()
                  clearStoredMe()
                  queryClient.clear()
                  await navigate({ to: '/login' })
                }}
              >
                Sign out
              </Button>
            </Row>
          </Group>
        </Section>

        <Section
          title="Steam accounts"
          action={
            me.steamLinks.length > 0 && (
              <Button size="sm" variant="ghost" onClick={linkSteam}>
                <SteamIcon /> Link another
              </Button>
            )
          }
        >
          {error && <p className="text-sm text-danger">{describeAuthError(error)}</p>}
          {me.steamLinks.length === 0 && (
            <Group>
              <Row
                label="No Steam account linked"
                description="Link one so subtick can pick up your matches."
              >
                <Button size="sm" variant="secondary" onClick={linkSteam}>
                  <SteamIcon /> Link Steam
                </Button>
              </Row>
            </Group>
          )}
          {me.steamLinks.map((link) => (
            <SteamLinkGroup key={link.steamId} link={link} />
          ))}
        </Section>
      </div>
    </div>
  )
}

/** A titled block of settings. The header is h-8 whether or not it has an action. */
const Section = ({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) => (
  <section className="grid gap-3">
    <div className="flex h-8 items-center justify-between gap-4">
      <h2 className="text-[15px] font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

/** A card of rows, divided by hairlines inset to the card's padding. */
const Group = ({ children }: { children: ReactNode }) => (
  <Card className="divide-y px-4">{children}</Card>
)

/** Label and description on the left, its control on the right. */
const Row = ({
  label,
  description,
  leading,
  children,
}: {
  label: ReactNode
  description?: ReactNode
  /** Before the label, e.g. an avatar. */
  leading?: ReactNode
  children?: ReactNode
}) => (
  <div className="flex min-h-16 items-center gap-3 py-3">
    {leading}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{label}</p>
      {description && <div className="mt-0.5 text-[13px] text-muted">{description}</div>}
    </div>
    {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  </div>
)

const SYNC_LABEL = {
  idle: 'Up to date',
  syncing: 'Syncing',
  needs_auth: 'Needs new code',
  error: 'Sync error',
} as const

function SteamLinkGroup({ link }: { link: Me['steamLinks'][number] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(!link.hasMatchAuth)
  const unlink = useMutation({
    mutationFn: () => unwrap(api['steam-links']({ steamId: link.steamId }).delete()),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const syncTone =
    link.syncState === 'needs_auth' || link.syncState === 'error' ? 'danger' : 'neutral'
  const lastSignIn =
    unlink.error instanceof ApiError && unlink.error.message === 'last_sign_in_method'

  return (
    <Group>
      <Row
        leading={<Avatar src={link.avatarUrl} name={link.personaName} className="size-9" />}
        label={link.personaName}
        description={
          lastSignIn ? (
            <span className="text-danger">
              This is your only way to sign in. Add an email account first.
            </span>
          ) : (
            'Steam account'
          )
        }
      >
        <Button
          size="sm"
          variant="danger-ghost"
          onClick={() => unlink.mutate()}
          disabled={unlink.isPending}
        >
          Unlink
        </Button>
      </Row>

      <Collapsible.Root open={editing} onOpenChange={setEditing}>
        <Row
          label="Match history"
          description={
            link.hasMatchAuth ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={syncTone}>{SYNC_LABEL[link.syncState]}</Badge>
                {link.lastSyncedAt && `checked ${timeAgo(link.lastSyncedAt)}`}
                {link.lastError && <span className="text-danger">{link.lastError}</span>}
              </span>
            ) : (
              'Not connected. Add an authentication code to pick up your matches.'
            )
          }
        >
          <Collapsible.Trigger
            render={
              <Button size="sm" variant={editing || link.hasMatchAuth ? 'outline' : 'primary'} />
            }
          >
            {editing ? 'Cancel' : link.hasMatchAuth ? 'Update code' : 'Connect'}
          </Collapsible.Trigger>
        </Row>
        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out-quart data-ending-style:h-0 data-starting-style:h-0">
          <div className="pb-4">
            <MatchAuthForm steamId={link.steamId} onDone={() => setEditing(false)} />
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Group>
  )
}
