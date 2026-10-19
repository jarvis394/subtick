import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge, Card, Skeleton } from '@/components/ui/surface'
import { FadeItem, FadeList } from '@/components/ui/presence'
import { type AdminRecorder, recordersQuery } from '@/lib/admin'
import { api, unwrap } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/recorders')({
  loader: ({ context }) => context.queryClient.prefetchQuery(recordersQuery),
  component: RecordersPage,
})

const STATE_LABEL = {
  starting: 'Starting',
  idle: 'Idle',
  recording: 'Recording',
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
    <section className="flex flex-col gap-4">
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
        <FadeList>
          {recorders.data?.map((recorder) => (
            <FadeItem key={recorder.id}>
              <RecorderCard
                recorder={recorder}
                token={issued?.id === recorder.id ? issued.token : null}
                onToken={(token) => setIssued({ id: recorder.id, token })}
                onDismissToken={() => setIssued(null)}
              />
            </FadeItem>
          ))}
        </FadeList>
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
    meta: { inlineError: true },
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
          <Button type="submit" variant="primary" loading={add.isPending}>
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
      variant="secondary"
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: { paused?: boolean }) =>
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
  const tone = state === 'recording' ? 'accent' : state ? 'success' : 'neutral'

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

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Detail label="Recording">
          {recorder.currentMatchId ? (
            <Link
              to="/matches/$id"
              params={{ id: recorder.currentMatchId }}
              className="link text-link"
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

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => update.mutate({ paused: !recorder.paused })}
          loading={update.isPending}
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
          loading={rotate.isPending}
        >
          New token
        </Button>
        <Button
          size="sm"
          variant="ghost"
          tone="danger"
          onClick={() => {
            if (confirm(`Remove ${recorder.name}? Its token stops working.`)) remove.mutate()
          }}
          loading={remove.isPending}
        >
          Remove
        </Button>
      </div>
      {update.error && <p className="text-sm text-danger">{update.error.message}</p>}
    </Card>
  )
}
