import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, inputClass } from '@/components/ui/field'
import { Badge, Card, Skeleton, Spinner } from '@/components/ui/surface'
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
  // Outlives the code form, which unmounts while the machine checks the code.
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null)

  const state = recorder.online && recorder.state ? recorder.state : null
  const signingIn = state === 'signing_in' || state === 'needs_guard_code'
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

      {state === 'needs_guard_code' && (
        <GuardCodeForm
          recorder={recorder}
          sentAt={codeSentAt}
          onSent={() => setCodeSentAt(Date.now())}
        />
      )}
      {state === 'signing_in' && (
        <SignInProgress
          checkingCode={codeSentAt !== null && Date.now() - codeSentAt < CODE_CHECK_LABEL_MS}
          note={recorder.lastError}
        />
      )}

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

      {/* While signing in, the code form shows what went wrong with the last attempt. */}
      {recorder.lastError && !signingIn && (
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

/** How long after sending a code "Signing in" reads as checking that code. */
const CODE_CHECK_LABEL_MS = 2 * 60_000
/** A sent code reads as on its way this long, covering the beat before the machine reports it. */
const CODE_PICKUP_MS = 12_000

function SignInProgress({ checkingCode, note }: { checkingCode: boolean; note: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-surface-2/50 p-4 text-sm">
      <Spinner className="size-4 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="font-medium">
          {checkingCode ? 'Checking the code with Steam…' : 'Signing in to Steam…'}
        </p>
        <p className="text-[13px] text-muted">
          {note ??
            (checkingCode
              ? 'The machine typed it in. This takes up to half a minute.'
              : 'Typing the account details into Steam.')}
        </p>
      </div>
    </div>
  )
}

function GuardCodeForm({
  recorder,
  sentAt,
  onSent,
}: {
  recorder: AdminRecorder
  sentAt: number | null
  onSent: () => void
}) {
  const queryClient = useQueryClient()
  const send = useMutation({
    mutationFn: (code: string) =>
      unwrap(api.admin.recorders({ id: recorder.id })['guard-code'].post({ code })),
    onSuccess: async () => {
      onSent()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'recorders'] })
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    send.mutate(String(new FormData(form).get('code')).trim(), { onSuccess: () => form.reset() })
  }
  // Sent, and the machine hasn't fetched it yet (it asks every few seconds) or hasn't yet said
  // it is checking it.
  const delivering =
    send.isPending ||
    recorder.awaitingGuardCode ||
    (sentAt !== null && Date.now() - sentAt < CODE_PICKUP_MS)

  return (
    <form onSubmit={submit} className="rounded-xl border border-danger/30 bg-danger/5 p-4">
      <Field
        label={`Steam is asking ${recorder.steamAccount?.username ?? 'this account'} for a Steam Guard code`}
        description={
          delivering ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-3" />
              {send.isPending ? 'Sending…' : 'Sent. Waiting for the machine to type it in…'}
            </span>
          ) : (
            "From the account's email or the Steam Guard mobile app. Steam waits only about a minute, then emails a new one."
          )
        }
        error={send.error?.message ?? (delivering ? undefined : recorder.lastError)}
      >
        <div className="flex gap-2">
          <Input
            name="code"
            required
            minLength={5}
            maxLength={5}
            placeholder="XXXXX"
            autoComplete="one-time-code"
            spellCheck={false}
            autoFocus
            disabled={delivering}
            className="min-w-0 flex-1 font-mono uppercase"
          />
          <Button type="submit" disabled={delivering} className="h-10 min-w-28">
            {send.isPending ? <Spinner className="size-3.5" /> : null}
            {send.isPending ? 'Sending' : recorder.awaitingGuardCode ? 'Sent' : 'Send code'}
          </Button>
        </div>
      </Field>
    </form>
  )
}
