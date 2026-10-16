import { Collapsible } from '@base-ui/react/collapsible'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
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

export const Route = createFileRoute('/_app/settings')({
  validateSearch: z.object({ error: z.string().optional() }),
  component: SettingsPage,
})

function SettingsPage() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { error } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const steamOnly = me.user.email.endsWith('@steam.invalid')

  return (
    <div className="mx-auto grid max-w-2xl gap-10">
      <h1 className="font-serif text-3xl tracking-tight">Settings</h1>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted">Account</h2>
        <Card className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="font-medium">{me.user.name}</p>
            <p className="truncate text-sm text-muted">
              {steamOnly ? 'Signed in with Steam' : me.user.email}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut()
              queryClient.clear()
              await navigate({ to: '/login' })
            }}
          >
            Sign out
          </Button>
        </Card>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Steam accounts</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void startSteamFlow('link', '/settings')}
          >
            <SteamIcon /> Link another
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{describeAuthError(error)}</p>}
        {me.steamLinks.length === 0 && (
          <Card className="p-4 text-sm text-muted">No Steam account linked yet.</Card>
        )}
        {me.steamLinks.map((link) => (
          <SteamLinkCard key={link.steamId} link={link} />
        ))}
      </section>
    </div>
  )
}

const SYNC_LABEL = {
  idle: 'Up to date',
  syncing: 'Syncing',
  needs_auth: 'Needs new code',
  error: 'Sync error',
} as const

function SteamLinkCard({ link }: { link: Me['steamLinks'][number] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(!link.hasMatchAuth)
  const unlink = useMutation({
    mutationFn: () => unwrap(api['steam-links']({ steamId: link.steamId }).delete()),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const syncTone =
    link.syncState === 'needs_auth' || link.syncState === 'error' ? 'danger' : 'neutral'

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar src={link.avatarUrl} name={link.personaName} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{link.personaName}</p>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            {link.hasMatchAuth ? (
              <>
                <Badge tone={syncTone}>{SYNC_LABEL[link.syncState]}</Badge>
                {link.lastSyncedAt && `checked ${timeAgo(link.lastSyncedAt)}`}
              </>
            ) : (
              <Badge tone="accent">Match history not connected</Badge>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => unlink.mutate()}
          disabled={unlink.isPending}
          className="text-danger hover:text-danger"
        >
          Unlink
        </Button>
      </div>
      {link.lastError && <p className="mt-3 text-sm text-danger">{link.lastError}</p>}
      {unlink.error instanceof ApiError && unlink.error.message === 'last_sign_in_method' && (
        <p className="mt-3 text-sm text-danger">
          This is your only way to sign in. Add an email account first.
        </p>
      )}

      <Collapsible.Root open={editing} onOpenChange={setEditing} className="mt-3 border-t pt-3">
        <Collapsible.Trigger className="cursor-pointer text-sm text-accent outline-none hover:underline focus-visible:underline">
          {link.hasMatchAuth ? 'Update authentication code' : 'Connect match history'}
        </Collapsible.Trigger>
        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out-quart data-ending-style:h-0 data-starting-style:h-0">
          <div className="pt-4">
            <MatchAuthForm steamId={link.steamId} onDone={() => setEditing(false)} />
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Card>
  )
}
