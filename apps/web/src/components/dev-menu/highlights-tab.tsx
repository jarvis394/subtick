import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { FadeItem, FadeList, Presence } from '@/components/ui/presence'
import { api, unwrap } from '@/lib/api'

const STATES = [
  { state: 'failed', label: 'Failed' },
  { state: 'recording', label: 'Recording' },
  { state: 'ready', label: 'Ready' },
] as const

type State = (typeof STATES)[number]['state'] | 'simulate'

const fakesKey = (matchId: string) => ['dev', 'highlights', matchId]

/** Adds fake highlights (failed, waiting on the recorder, recorded) to a match, and removes them. */
export const DevHighlightsTab = ({
  matchId,
  onNavigate,
}: {
  /** The match open now, or the last one that was. */
  matchId: string | null
  onNavigate: () => void
}) => {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: fakesKey(matchId ?? ''),
    queryFn: () => unwrap(api.dev.highlights.get({ query: { matchId: matchId! } })),
    enabled: matchId !== null,
  })
  // What shows highlights re-reads them; the fakes list is its own query.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dev', 'highlights'] }),
      queryClient.invalidateQueries({ queryKey: ['match', matchId] }),
      queryClient.invalidateQueries({ queryKey: ['highlights'] }),
      queryClient.invalidateQueries({ queryKey: ['queue'] }),
    ])
  const add = useMutation({
    mutationFn: (state: State) => unwrap(api.dev.highlights.post({ matchId: matchId!, state })),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.dev.highlights({ id }).delete()),
    onSuccess: refresh,
  })

  if (matchId === null) {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-muted">
        Open a match first: fake highlights go onto it
      </p>
    )
  }

  return (
    <div className="grid gap-3 p-3">
      <Link
        to="/matches/$id"
        params={{ id: matchId }}
        onClick={onNavigate}
        className="truncate px-1 text-[11px] text-muted hover:text-foreground"
      >
        Adding to match {matchId}
      </Link>
      <div className="grid grid-cols-3 gap-1.5">
        {STATES.map(({ state, label }) => (
          <Button
            key={state}
            size="sm"
            onClick={() => add.mutate(state)}
            disabled={add.isPending}
            className="px-2"
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          onClick={() => add.mutate('simulate')}
          disabled={add.isPending}
          className="col-span-3"
        >
          Simulate a 10s recording
        </Button>
      </div>
      {add.error && (
        <p className="px-1 text-[12px] text-danger">
          {add.error.message === 'no_clip_to_borrow'
            ? 'No recorded clip to borrow a video from'
            : 'Could not add it'}
        </p>
      )}

      {data && (
        <div className="grid">
          <FadeList>
            {data.map((fake) => (
              <FadeItem key={fake.id}>
                <div className="flex h-11 items-center gap-2.5 rounded-xl border bg-surface pr-1.5 pl-3">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {fake.title.replace('[dev] ', '')}
                  </span>
                  <IconButton
                    size="sm"
                    label="Delete"
                    aria-label={`Delete ${fake.title}`}
                    onClick={() => remove.mutate(fake.id)}
                  >
                    <X />
                  </IconButton>
                </div>
                <div className="h-1" />
              </FadeItem>
            ))}
          </FadeList>
          <Presence show={data.length === 0}>
            <p className="py-4 text-center text-[12px] text-muted">No fake highlights here yet</p>
          </Presence>
        </div>
      )}
    </div>
  )
}
