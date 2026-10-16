import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge, Card, Skeleton } from '@/components/ui/surface'
import { type AdminSteamAccount, steamAccountsQuery } from '@/lib/admin'
import { ApiError, api, unwrap } from '@/lib/api'

export const Route = createFileRoute('/_app/admin/steam-accounts')({
  loader: ({ context }) => context.queryClient.prefetchQuery(steamAccountsQuery),
  component: SteamAccountsPage,
})

const describe = (error: Error | null) =>
  error instanceof ApiError && error.message === 'username_taken'
    ? 'That account is already added.'
    : error instanceof ApiError && error.status === 422
      ? 'Check the fields: the shared secret is the base64 value from your authenticator export.'
      : error?.message

function SteamAccountsPage() {
  const accounts = useQuery(steamAccountsQuery)
  const [adding, setAdding] = useState(false)

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Accounts the recorders' game clients sign in with. Use dedicated accounts: one account can
          play on one machine at a time, and not as the steam worker's bot.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={adding}>
          <Plus /> Add account
        </Button>
      </div>

      {adding && <AccountForm onDone={() => setAdding(false)} />}

      {accounts.isPending ? (
        <Skeleton className="h-32" />
      ) : accounts.data?.length === 0 && !adding ? (
        <Card className="p-6 text-sm text-muted">No Steam accounts yet.</Card>
      ) : (
        accounts.data?.map((account) => <AccountCard key={account.id} account={account} />)
      )}
    </section>
  )
}

/** Adds an account, or with `account` changes its secrets (blank fields keep what's stored). */
function AccountForm({ account, onDone }: { account?: AdminSteamAccount; onDone: () => void }) {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: async (form: FormData): Promise<unknown> => {
      const value = (name: string) => String(form.get(name) ?? '').trim() || undefined
      if (account)
        return unwrap(
          api.admin['steam-accounts']({ id: account.id }).patch({
            password: value('password'),
            sharedSecret: value('sharedSecret'),
            note: String(form.get('note') ?? ''),
          }),
        )
      return unwrap(
        api.admin['steam-accounts'].post({
          username: value('username') ?? '',
          password: value('password') ?? '',
          sharedSecret: value('sharedSecret'),
          note: value('note'),
        }),
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      onDone()
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate(new FormData(event.currentTarget))
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
        {!account && (
          <Field label="Username" description="The Steam login name, not the profile name.">
            <Input name="username" required autoFocus spellCheck={false} />
          </Field>
        )}
        <Field
          label={account ? 'New password' : 'Password'}
          description={account ? 'Leave blank to keep the stored one.' : undefined}
        >
          <Input name="password" type="password" required={!account} autoComplete="new-password" />
        </Field>
        <Field
          label="Shared secret"
          description={
            account?.hasSharedSecret
              ? 'Stored. Leave blank to keep it.'
              : 'Optional: from a mobile authenticator export. Without it, Steam emails a code on sign-in.'
          }
        >
          <Input name="sharedSecret" type="password" autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Note">
          <Input name="note" defaultValue={account?.note ?? ''} maxLength={200} />
        </Field>
        {save.error && <p className="text-sm text-danger sm:col-span-2">{describe(save.error)}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {account ? 'Save' : 'Add account'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AccountCard({ account }: { account: AdminSteamAccount }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const remove = useMutation({
    mutationFn: () => unwrap(api.admin['steam-accounts']({ id: account.id }).delete()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
  const removeSecret = useMutation({
    mutationFn: () =>
      unwrap(api.admin['steam-accounts']({ id: account.id }).patch({ sharedSecret: null })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })

  if (editing) return <AccountForm account={account} onDone={() => setEditing(false)} />

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          {account.username}
          <Badge tone={account.hasSharedSecret ? 'success' : 'neutral'}>
            {account.hasSharedSecret ? 'Authenticator' : 'Email codes'}
          </Badge>
        </p>
        <p className="truncate text-[13px] text-muted">
          {account.recorder ? `Used by ${account.recorder.name}` : 'Not assigned'}
          {account.note && ` · ${account.note}`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {account.hasSharedSecret && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeSecret.mutate()}
            disabled={removeSecret.isPending}
          >
            Remove secret
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => {
            const warning = account.recorder
              ? ` ${account.recorder.name} keeps its current sign-in but won't be told about changes.`
              : ''
            if (confirm(`Remove ${account.username}?${warning}`)) remove.mutate()
          }}
          disabled={remove.isPending}
        >
          Remove
        </Button>
      </div>
    </Card>
  )
}
