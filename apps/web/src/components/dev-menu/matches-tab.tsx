import { mapName } from '@subtick/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useEffect } from 'react'
import { MapIcon } from '@/components/map-icon'
import { Button, IconButton } from '@/components/ui/button'
import { FadeItem, FadeList, Presence } from '@/components/ui/presence'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { api, unwrap } from '@/lib/api'
import { cn } from '@/lib/utils'

// Not under ['matches']: the match page reads every list cached there as a list of matches.
const fakesQuery = {
  queryKey: ['dev', 'fakes'],
  queryFn: () => unwrap(api.dev.matches.get()),
}

type Fakes = Awaited<ReturnType<typeof fakesQuery.queryFn>>
type FakeCard = Fakes['pending'][number]

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

      {/* Mounted with the first data, so what's already there doesn't animate in. */}
      {data && (
        <div className="-mr-1 grid max-h-80 overflow-y-auto pr-1">
          <Section
            title="Staged"
            hint="Turn up on the next check for new matches"
            fakes={data.pending}
          />
          <Section title="Added" fakes={data.added} onNavigate={onNavigate} />
          <Presence show={!data.pending.length && !data.added.length}>
            <p className="py-4 text-center text-[12px] text-muted">No fake matches yet</p>
          </Presence>
        </div>
      )}
    </div>
  )
}

/** A titled list of fakes; rows fade in and out, and the section goes with its last. */
const Section = ({
  title,
  hint,
  fakes,
  onNavigate,
}: {
  title: string
  hint?: string
  fakes: FakeCard[]
  onNavigate?: () => void
}) => (
  <Presence show={fakes.length > 0}>
    <section className="grid pb-1">
      <p className="mb-1 px-1 text-[11px] font-medium text-muted" title={hint}>
        {title} · {fakes.length}
      </p>
      <FadeList>
        {fakes.map((fake) => (
          <FadeItem key={fake.id}>
            <FakeRow fake={fake} onNavigate={onNavigate} />
          </FadeItem>
        ))}
      </FadeList>
    </section>
  </Presence>
)

// Room on the right for the delete button, which sits over the card rather than inside the link.
const cardClass =
  'flex h-11 items-center gap-2.5 rounded-xl border bg-surface pr-10 pl-2 outline-none'

/**
 * One fake match. Once a refresh has added it, the card opens the match. The cross unstages it,
 * or deletes it once added.
 */
const FakeRow = ({ fake, onNavigate }: { fake: FakeCard; onNavigate?: () => void }) => {
  const queryClient = useQueryClient()
  // Dropped from the cache at once, so it fades out; a failure puts it back.
  const remove = useMutation({
    mutationFn: () => unwrap(api.dev.matches({ id: fake.id }).delete()),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: fakesQuery.queryKey })
      const previous = queryClient.getQueryData<Fakes>(fakesQuery.queryKey)
      queryClient.setQueryData<Fakes>(
        fakesQuery.queryKey,
        (data) =>
          data && {
            pending: data.pending.filter((f) => f.id !== fake.id),
            added: data.added.filter((f) => f.id !== fake.id),
          },
      )
      return { previous }
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(fakesQuery.queryKey, context?.previous),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: fakesQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
      ]),
  })

  return (
    <div className="pb-1">
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
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
        >
          <X />
        </IconButton>
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
