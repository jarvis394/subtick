import { Collapsible } from '@base-ui/react/collapsible'
import { Dialog } from '@base-ui/react/dialog'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { z } from 'zod'
import { EmailForm } from '@/components/email-form'
import { MatchAuthForm } from '@/components/match-auth-form'
import { ProfileSection } from '@/components/settings/profile-section'
import { SteamIcon } from '@/components/steam-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { MorphLabel } from '@/components/ui/morph-label'
import { FadeItem, FadeList, Presence } from '@/components/ui/presence'
import { Badge, Card } from '@/components/ui/surface'
import { ApiError, api, unwrap } from '@/lib/api'
import { authClient, describeAuthError, startSteamFlow } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { type Me, meQuery } from '@/lib/queries'
import { clearStoredMe } from '@/lib/stored-me'

export const Route = createFileRoute('/_app/settings')({
  validateSearch: z.object({
    error: z.string().optional(),
    email: z.literal('confirmed').optional(),
  }),
  component: SettingsPage,
})

const linkSteam = () => void startSteamFlow('link', '/settings')

function SettingsPage() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { error, email: emailStatus } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editingEmail, setEditingEmail] = useState(false)
  const steamOnly = !me.user.hasPassword
  const emailError = error?.startsWith('email_') ? error : undefined
  const steamError = emailError ? undefined : error

  return (
    <div className="mx-auto grid max-w-2xl gap-10 @3xl:max-w-5xl">
      <h1 className="font-serif text-3xl tracking-tight">Settings</h1>

      {/* Sections sit side by side once the content area (not the viewport: the sidebar takes
        its share) has room for two readable columns. */}
      <div className="grid gap-10 @3xl:grid-cols-2 @3xl:items-start @3xl:gap-6">
        <ProfileSection me={me} />

        <Section title="Account">
          {emailStatus === 'confirmed' && (
            <p className="text-sm text-accent">Email confirmed. You can sign in with it now</p>
          )}
          {emailError && (
            <p className="text-sm text-danger select-text">{describeAuthError(emailError)}</p>
          )}
          <Group>
            <Row
              // Same picture as the sidebar; the initial stands in when there is none.
              leading={<Avatar src={me.user.avatarUrl} name={me.user.name} className="size-9" />}
              label={me.user.name}
              description={steamOnly ? 'Signed in with Steam' : me.user.email}
            >
              <Button
                size="sm"
                variant="ghost"
                tone="danger"
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
            <Collapsible.Root open={editingEmail} onOpenChange={setEditingEmail}>
              <Row
                label="Email"
                description={
                  steamOnly ? 'Add one to sign in without Steam' : 'Where sign-in links are sent'
                }
              >
                <Collapsible.Trigger render={<Button size="sm" variant="secondary" />}>
                  <MorphLabel>
                    {editingEmail ? 'Cancel' : steamOnly ? 'Add email' : 'Change'}
                  </MorphLabel>
                </Collapsible.Trigger>
              </Row>
              <Collapsible.Panel className="-mx-1 h-(--collapsible-panel-height) overflow-hidden px-1 transition-[height] duration-200 ease-out-quart data-ending-style:h-0 data-starting-style:h-0">
                <div className="pb-4">
                  <EmailForm adding={steamOnly} />
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
            <Row
              label="Delete account"
              description="Removes your account and linked Steam accounts. This can't be undone"
            >
              <DeleteAccountDialog />
            </Row>
          </Group>
        </Section>

        <Section
          title="Steam accounts"
          action={
            me.steamLinks.length > 0 && (
              <Button size="sm" variant="secondary" onClick={linkSteam}>
                <SteamIcon /> Link another
              </Button>
            )
          }
        >
          {steamError && (
            <p className="text-sm text-danger select-text">{describeAuthError(steamError)}</p>
          )}
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
          <FadeList>
            {me.steamLinks.map((link) => (
              <FadeItem key={link.steamId}>
                <SteamLinkGroup
                  link={link}
                  onAddEmail={() => {
                    setEditingEmail(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              </FadeItem>
            ))}
          </FadeList>
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
  <section className="flex flex-col gap-3">
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

function SteamLinkGroup({
  link,
  onAddEmail,
}: {
  link: Me['steamLinks'][number]
  onAddEmail: () => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(!link.hasMatchAuth)
  const unlink = useMutation({
    meta: { inlineError: true },
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
          <>
            Steam account
            <Presence show={lastSignIn}>
              <p className="pt-1 leading-relaxed text-danger">
                This is your only way to sign in.
                <br />
                <Button
                  variant="link"
                  tone="danger"
                  onClick={() => {
                    unlink.reset()
                    onAddEmail()
                  }}
                >
                  Add an email
                </Button>{' '}
                first, then unlink it
              </p>
            </Presence>
          </>
        }
      >
        <Button
          size="sm"
          variant="ghost"
          tone="danger"
          onClick={() => unlink.mutate()}
          loading={unlink.isPending}
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
                {link.lastError && (
                  <span className="text-danger select-text">{link.lastError}</span>
                )}
              </span>
            ) : (
              'Not connected. Add an authentication code to pick up your matches.'
            )
          }
        >
          <Collapsible.Trigger render={<Button size="sm" variant="secondary" />}>
            <MorphLabel>
              {editing ? 'Cancel' : link.hasMatchAuth ? 'Update code' : 'Connect'}
            </MorphLabel>
          </Collapsible.Trigger>
        </Row>
        <Collapsible.Panel className="-mx-1 h-(--collapsible-panel-height) overflow-hidden px-1 transition-[height] duration-200 ease-out-quart data-ending-style:h-0 data-starting-style:h-0">
          <div className="pb-4">
            <MatchAuthForm steamId={link.steamId} onDone={() => setEditing(false)} />
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Group>
  )
}

const CONFIRMATION = 'i am sure'

/**
 * Deletes the account after the user types the confirmation phrase. The input's native `pattern`
 * gates the button and the submit, so there's no hand-rolled check to drift from the copy.
 */
function DeleteAccountDialog() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const remove = useMutation({
    meta: { inlineError: true },
    mutationFn: async () => {
      const { error } = await authClient.deleteUser({})
      if (error) throw error
    },
    onSuccess: async () => {
      clearStoredMe()
      queryClient.clear()
      await navigate({ to: '/login' })
    },
  })

  const error = remove.error as { code?: string; message?: string } | null
  const message =
    error &&
    (error.code === 'SESSION_EXPIRED'
      ? 'For your safety, sign out and sign back in, then delete your account within a day'
      : error.message || 'Could not delete your account. Please try again')

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmed(false)
          remove.reset()
        }
      }}
    >
      <Dialog.Trigger render={<Button size="sm" variant="ghost" tone="danger" />}>
        Delete
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-surface p-6 shadow-2xl outline-none transition-[opacity,scale] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-medium">Delete your account?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">
            Your account, its linked Steam accounts and your place in their matches are removed for
            good. Clips stay for the other players in those matches.
          </Dialog.Description>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              remove.mutate()
            }}
          >
            <Field
              label={
                <>
                  Type{' '}
                  <span className="mx-0.5 rounded bg-danger/12 px-1 py-px text-danger">
                    {CONFIRMATION}
                  </span>{' '}
                  to confirm
                </>
              }
            >
              <Input
                name="confirmation"
                required
                // Native validation: the whole value must match, nothing more.
                pattern={CONFIRMATION}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setConfirmed(event.currentTarget.validity.valid)}
              />
            </Field>
            {message && <p className="text-[13px] text-danger select-text">{message}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
              <Button
                type="submit"
                variant="primary"
                tone="danger"
                disabled={!confirmed}
                loading={remove.isPending}
              >
                Delete account
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
