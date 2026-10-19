import { mapName } from '@subtick/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { MapIcon } from '@/components/map-icon'
import { Button, IconButton } from '@/components/ui/button'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { api, unwrap } from '@/lib/api'
import { cn } from '@/lib/utils'

// Not under ['matches']: the match page reads every list cached there as a list of matches.
const fakesQuery = {
  queryKey: ['dev', 'fakes'],
  queryFn: () => unwrap(api.dev.matches.get()),
}

type FakeCard = Awaited<ReturnType<typeof fakesQuery.queryFn>>['pending'][number]

/** Stages fake matches for the next "Check for new", and lists the ones it made. */
export const DevMatchesTab = ({ onNavigate }: { onNavigate: () => void }) => {
  const queryClient = useQueryClient()
  const { data, refetch } = useQuery(fakesQuery)
  // A refresh turns staged matches into added ones.
  const refreshedAt = useRefreshMatches().data?.at
  useEffect(() => {
    if (refreshedAt !== undefined) void refetch()
  }, [refreshedAt, refetch])
  const stage = useMutation({
    mutationFn: () => unwrap(api.dev.matches.post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fakesQuery.queryKey }),
  })

  return (
    <div className="grid gap-3 p-3">
      <Button size="sm" onClick={() => stage.mutate()} loading={stage.isPending}>
        <Plus />
        Add random match
      </Button>

      <div className="-mr-1 grid max-h-80 overflow-y-auto pr-1">
        <Section title="Staged" hint="Turn up on the next check for new matches">
          {data?.pending.map((fake) => (
            <FakeRow key={fake.id} fake={fake} />
          ))}
        </Section>
        <Section title="Added">
          {data?.added.map((fake) => (
            <FakeRow key={fake.id} fake={fake} onNavigate={onNavigate} />
          ))}
        </Section>
        {data && !data.pending.length && !data.added.length && (
          <p className="py-4 text-center text-[12px] text-muted">No fake matches yet</p>
        )}
      </div>
    </div>
  )
}

const Section = ({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode[] | undefined
}) =>
  children?.length ? (
    <section className="grid pb-1">
      <p className="mb-1 px-1 text-[11px] font-medium text-muted" title={hint}>
        {title} · {children.length}
      </p>
      {children}
    </section>
  ) : null

// Room on the right for the delete button, which sits over the card rather than inside the link.
const cardClass =
  'flex h-11 items-center gap-2.5 rounded-xl border bg-surface pr-10 pl-2 outline-none'

/**
 * One fake match. Once a refresh has added it, the card opens the match. The cross unstages it,
 * or deletes it once added.
 */
const FakeRow = ({ fake, onNavigate }: { fake: FakeCard; onNavigate?: () => void }) => {
  const queryClient = useQueryClient()
  // Collapses as soon as it's asked to go, then the refetch drops it for good.
  const [removing, setRemoving] = useState(false)
  const remove = useMutation({
    mutationFn: () => unwrap(api.dev.matches({ id: fake.id }).delete()),
    onMutate: () => setRemoving(true),
    onError: () => setRemoving(false),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: fakesQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
      ]),
  })

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out-quart',
        removing ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] starting:opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden pb-1">
        <div className="relative">
          {onNavigate ? (
            <Link
              to="/matches/$id"
              params={{ id: fake.id }}
              onClick={onNavigate}
              className={cn(
                cardClass,
                'transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              )}
            >
              <FakeSummary fake={fake} />
            </Link>
          ) : (
            <div className={cardClass}>
              <FakeSummary fake={fake} />
            </div>
          )}
          <IconButton
            size="sm"
            label="Delete"
            aria-label={`Delete fake ${mapName(fake.map)} match`}
            onClick={() => remove.mutate()}
            disabled={removing}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

const FakeSummary = ({ fake }: { fake: FakeCard }) => (
  <>
    <MapIcon map={fake.map} className="size-6 rounded-md text-[11px]" />
    <span className="min-w-0 flex-1 truncate text-[13px]">{mapName(fake.map)}</span>
    <span className="font-mono text-[12px] tabular-nums">
      <span className={fake.ownScore > fake.enemyScore ? 'text-success' : 'text-danger'}>
        {fake.ownScore}
      </span>
      <span className="text-muted">:</span>
      {fake.enemyScore}
    </span>
  </>
)
