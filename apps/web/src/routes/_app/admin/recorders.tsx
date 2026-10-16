import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, inputClass } from '@/components/ui/field'
import { Badge, Card, Skeleton } from '@/components/ui/surface'
import { type AdminRecorder, recordersQuery, steamAccountsQuery } from '@/lib/admin'
import { ApiError, api, unwrap } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/recorders')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(recordersQuery),
      context.queryClient.prefetchQuery(steamAccountsQuery),
    ]),
  component: RecordersPage,
})

const STATE_LABEL = {
  starting: 'Starting',
  idle: 'Idle',
  signing_in: 'Signing in',
  needs_guard_code: 'Needs Steam Guard code',
  recording: 'Recording',
  error: 'Error',
} as const

/** A token is shown once, right after it's made. */
interface Issued {
  id: string
  token: string
}

function RecordersPage() {
  const recorders = useQuery(recordersQuery)
  const [adding, setAdding] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Machines that record clips. Each runs the recorder container with its own token.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={adding}>
          <Plus /> Add recorder
        </Button>
      </div>

      {adding && (
        <AddRecorderForm
          onCancel={() => setAdding(false)}
          onAdded={(next) => {
            setAdding(false)
            setIssued(next)
          }}
        />
      )}

      {recorders.isPending ? (
        <Skeleton className="h-40" />
      ) : recorders.data?.length === 0 && !adding ? (
        <Card className="p-6 text-sm text-muted">
          No recorders yet. Add one, then start the recorder container on a machine with an NVIDIA
          GPU using the token it gives you.
        </Card>
      ) : (
        recorders.data?.map((recorder) => (
          <RecorderCard
            key={recorder.id}
            recorder={recorder}
            token={issued?.id === recorder.id ? issued.token : null}
            onToken={(token) => setIssued({ id: recorder.id, token })}
            onDismissToken={() => setIssued(null)}
          />
        ))
      )}
    </section>
  )
}

function AddRecorderForm({
  onAdded,
  onCancel,
}: {
  onAdded: (issued: Issued) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: (name: string) => unwrap(api.admin.recorders.post({ name })),
    onSuccess: async (issued) => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      onAdded(issued)
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    add.mutate(String(new FormData(event.currentTarget).get('name')))
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label="Name" description="e.g. the machine's hostname" className="min-w-56 flex-1">
          <Input name="name" required maxLength={64} autoFocus autoComplete="off" />
        </Field>
        <div className="flex gap-2 pb-6">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={add.isPending}>
            Add
          </Button>
        </div>
      </form>
      {add.error && <p className="text-sm text-danger">{add.error.message}</p>}
    </Card>
  )
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function TokenNotice({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const env = `SUBTICK_URL=${window.location.origin}\nRECORDER_TOKEN=${token}`
  return (
    <div className="grid gap-3 rounded-xl border border-accent/40 bg-accent/6 p-4">
      <p className="text-sm">
        Add these to the machine's <code className="font-mono text-[13px]">recorder.env</code> and
        restart its container. The token is shown only now; if it's lost, make a new one.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px] select-all">
        {env}
      </pre>
      <div className="flex gap-2">
        <CopyButton text={env} />
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  )
}

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[12px] text-muted">{label}</dt>
    <dd className="truncate text-sm">{children}</dd>
  </div>
)

function RecorderCard({
  recorder,
  token,
  onToken,
  onDismissToken,
}: {
  recorder: AdminRecorder
  token: string | null
  onToken: (token: string) => void
  onDismissToken: () => void
}) {
  const queryClient = useQueryClient()
  const accounts = useQuery(steamAccountsQuery)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const update = useMutation({
    mutationFn: (body: { paused?: boolean; steamAccountId?: string | null }) =>
      unwrap(api.admin.recorders({ id: recorder.id }).patch(body)),
    onSuccess: refresh,
  })
  const rotate = useMutation({
    mutationFn: () => unwrap(api.admin.recorders({ id: recorder.id }).token.post()),
    onSuccess: (issued) => onToken(issued.token),
  })
  const remove = useMutation({
    mutationFn: () => unwrap(api.admin.recorders({ id: recorder.id }).delete()),
    onSuccess: refresh,
  })

  const state = recorder.online && recorder.state ? recorder.state : null
  const tone =
    state === 'error' || state === 'needs_guard_code'
      ? 'danger'
      : state === 'recording' || state === 'signing_in'
        ? 'accent'
        : state
          ? 'success'
          : 'neutral'
  const accountMismatch =
    recorder.online &&
    recorder.steamAccount &&
    recorder.signedInAs !== recorder.steamAccount.username
  const updateError =
    update.error instanceof ApiError && update.error.message === 'account_in_use'
      ? 'That account is already assigned to another recorder.'
      : update.error?.message

  return (
    <Card className="grid gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'size-2.5 shrink-0 rounded-full',
            recorder.online ? 'bg-success' : 'bg-muted/40',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{recorder.name}</p>
          <p className="text-[13px] text-muted">
            {recorder.online
              ? `online · ${recorder.hostname ?? 'unknown host'}`
              : recorder.lastSeenAt
                ? `offline · last seen ${timeAgo(recorder.lastSeenAt)}`
                : 'never connected'}
          </p>
        </div>
        {recorder.paused && <Badge>Paused</Badge>}
        <Badge tone={tone}>{state ? STATE_LABEL[state] : 'Offline'}</Badge>
      </div>

      {token && <TokenNotice token={token} onDismiss={onDismissToken} />}

      {state === 'needs_guard_code' && <GuardCodeForm recorder={recorder} />}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Detail label="Signed in as">{recorder.signedInAs ?? '—'}</Detail>
        <Detail label="Recording">
          {recorder.currentMatchId ? (
            <Link
              to="/matches/$id"
              params={{ id: recorder.currentMatchId }}
              className="text-accent hover:underline"
            >
              match
            </Link>
          ) : (
            '—'
          )}
        </Detail>
        <Detail label="Clips since start">{recorder.online ? recorder.clipsRecorded : '—'}</Detail>
        <Detail label="Up since">{recorder.online ? timeAgo(recorder.startedAt) : '—'}</Detail>
        <Detail label="GPU">{recorder.gpu ?? '—'}</Detail>
        <Detail label="Version">{recorder.version ?? '—'}</Detail>
        <Detail label="Token">
          <span className="font-mono text-[13px]">{recorder.tokenHint}…</span>
        </Detail>
      </dl>

      {recorder.lastError && (
        <p className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger">{recorder.lastError}</p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
        <Field
          label="Steam account"
          className="min-w-56 flex-1"
          description={
            accountMismatch ? 'Switches between jobs, once the machine is idle.' : undefined
          }
        >
          <select
            className={inputClass}
            value={recorder.steamAccount?.id ?? ''}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ steamAccountId: event.target.value || null })}
          >
            <option value="">None (sign in over VNC or with env vars)</option>
            {accounts.data?.map((account) => (
              <option
                key={account.id}
                value={account.id}
                disabled={account.recorder !== null && account.recorder.id !== recorder.id}
              >
                {account.username}
                {account.recorder && account.recorder.id !== recorder.id
                  ? ` (on ${account.recorder.name})`
                  : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-2 pb-px">
          <Button
            size="sm"
            variant="outline"
            onClick={() => update.mutate({ paused: !recorder.paused })}
            disabled={update.isPending}
          >
            {recorder.paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`New token for ${recorder.name}? The current one stops working.`))
                rotate.mutate()
            }}
            disabled={rotate.isPending}
          >
            New token
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => {
              if (confirm(`Remove ${recorder.name}? Its token stops working.`)) remove.mutate()
            }}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        </div>
      </div>
      {updateError && <p className="text-sm text-danger">{updateError}</p>}
    </Card>
  )
}

function GuardCodeForm({ recorder }: { recorder: AdminRecorder }) {
  const queryClient = useQueryClient()
  const send = useMutation({
    mutationFn: (code: string) =>
      unwrap(api.admin.recorders({ id: recorder.id })['guard-code'].post({ code })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'recorders'] }),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send.mutate(String(new FormData(event.currentTarget).get('code')))
    event.currentTarget.reset()
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
    >
      <Field
        label={`Steam emailed a code to ${recorder.steamAccount?.username ?? 'the account'}'s address`}
        description={
          recorder.awaitingGuardCode
            ? 'Sent; the machine picks it up within a few seconds.'
            : 'Enter it here and the machine types it in.'
        }
        error={send.error?.message}
        className="min-w-56 flex-1"
      >
        <Input
          name="code"
          required
          minLength={5}
          maxLength={5}
          placeholder="XXXXX"
          autoComplete="one-time-code"
          spellCheck={false}
          className="font-mono uppercase"
        />
      </Field>
      <div className="pb-6">
        <Button type="submit" disabled={send.isPending}>
          Send code
        </Button>
      </div>
    </form>
  )
}
