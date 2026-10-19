import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { EmptyState } from '@/components/empty-state'
import { KindTabs } from '@/components/kind-tabs'
import { MomentCard } from '@/components/moment-card'
import { FadeItem, FadeList, fade } from '@/components/ui/presence'
import { Skeleton } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { useCancelMoment } from '@/hooks/use-match-actions'
import { useRecordMoment } from '@/hooks/use-record-moment'
import { KIND_FILTERS, clipListSearch } from '@/lib/highlights'
import { type MatchDetail, matchQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/matches_/$id/create')({
  validateSearch: clipListSearch.pick({ kind: true, mine: true }),
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(matchQuery(params.id)),
  component: CreateHighlightsPage,
})

type Highlight = MatchDetail['highlights'][number]

const byRound = (moments: Highlight[]) => {
  const rounds = new Map<number, Highlight[]>()
  for (const m of moments.toSorted((a, b) => a.round - b.round || a.startTick - b.startTick))
    rounds.set(m.round, [...(rounds.get(m.round) ?? []), m])
  return [...rounds]
}

// Recording or cancelling a moment fades its card out of one section and into the other, and
// everything around it slides to its new place.
const Section = ({
  ref,
  title,
  children,
}: {
  ref?: Ref<HTMLElement>
  title: string
  children: ReactNode
}) => (
  <motion.section ref={ref} {...fade}>
    <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>
    <div className="grid gap-3 md:grid-cols-2">
      <FadeList>{children}</FadeList>
    </div>
  </motion.section>
)

function CreateHighlightsPage() {
  const { id } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useQuery(matchQuery(id))
  const record = useRecordMoment(id)
  const cancel = useCancelMoment(id)

  const kind = search.kind ?? 'all'
  const kinds: readonly string[] = KIND_FILTERS.find((f) => f.id === kind)!.kinds
  const viewer = data?.viewerSteamId
  const shown = (data?.highlights ?? []).filter(
    (h) =>
      !h.clip &&
      (kinds.length === 0 || kinds.includes(h.kind)) &&
      (!search.mine || h.steamId === viewer),
  )
  // In the order the recorder works through them (demo order), so a newly queued moment lands
  // where it will actually be recorded.
  const queue = shown
    .filter((h) => h.status === 'queued' || h.status === 'failed')
    .toSorted((a, b) => a.startTick - b.startTick)
  const rounds = byRound(shown.filter((h) => h.status === 'candidate'))

  const players = new Map(data?.players.map((p) => [p.steamId, p]))
  const playerOf = (steamId: string) => {
    const p = players.get(steamId)
    return { name: p?.name ?? 'Unknown', avatarUrl: p?.avatarUrl ?? null }
  }
  const card = (h: Highlight) => (
    <FadeItem key={h.id}>
      <MomentCard
        moment={h}
        match={data!}
        player={playerOf(h.steamId)}
        onRecord={() => record.mutate(h.id)}
        recording={record.isPending && record.variables === h.id}
        onCancel={() => cancel.mutate(h.id)}
        cancelling={cancel.isPending && cancel.variables === h.id}
      />
    </FadeItem>
  )

  return (
    <div>
      <Link
        to="/matches/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Match
      </Link>
      <h1 className="mb-6 font-serif text-3xl tracking-tight">Create highlights</h1>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <KindTabs
          value={kind}
          onChange={(value) =>
            navigate({ search: (s) => ({ ...s, kind: value === 'all' ? undefined : value }) })
          }
        />
        {viewer && (
          <Switch
            checked={Boolean(search.mine)}
            onCheckedChange={(mine) =>
              navigate({ search: (s) => ({ ...s, mine: mine || undefined }) })
            }
            className="ml-auto"
          >
            Only mine
          </Switch>
        )}
      </div>

      {!data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <LayoutGroup>
          <div className="grid gap-10">
            <FadeList>
              {/* In the list with the sections, so it fades with them as filters change. */}
              {queue.length === 0 && rounds.length === 0 && (
                <FadeItem key="empty">
                  <EmptyState
                    icon={<SearchX />}
                    title="No moments to record here"
                    description={
                      kind !== 'all' || search.mine
                        ? 'Try another kind, or turn off Only mine'
                        : 'Every moment in this match is recorded or queued'
                    }
                  />
                </FadeItem>
              )}
              {queue.length > 0 && (
                <Section key="queue" title="Queue">
                  {queue.map(card)}
                </Section>
              )}
              {rounds.map(([round, moments]) => (
                <Section key={`round-${round}`} title={`Round ${round}`}>
                  {moments.map(card)}
                </Section>
              ))}
            </FadeList>
          </div>
        </LayoutGroup>
      )}
    </div>
  )
}
