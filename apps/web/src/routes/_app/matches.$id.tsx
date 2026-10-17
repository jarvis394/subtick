import { Tabs } from '@base-ui/react/tabs'
import { mapName } from '@subtick/domain'
import { type QueryClient, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { FadeSwap } from '@/components/fade-swap'
import { HighlightCard } from '@/components/highlight-card'
import { MapIcon } from '@/components/map-icon'
import { perspectiveScore } from '@/components/match-table'
import { MatchStatusBadge } from '@/components/match-status'
import { MomentRow } from '@/components/moment-row'
import { RoundTimeline } from '@/components/round-timeline'
import { Scoreboard } from '@/components/scoreboard'
import { Skeleton } from '@/components/ui/surface'
import { formatDate } from '@/lib/format'
import { clipMask, clipViewerSearch } from '@/lib/highlights'
import { type MatchDetail, type MatchListItem, matchQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** Everything the page header shows, so it can render before the full match has loaded. */
interface MatchHead {
  map: string | null
  playedAt: Date | string | null
  roundsPlayed: number | null
  mode: string | null
  status: MatchListItem['status']
  score: ReturnType<typeof perspectiveScore>
  hasPlayer: boolean
}

const headFromDetail = (data: MatchDetail): MatchHead => {
  const me = data.players.find((p) => p.steamId === data.viewerSteamId)
  return {
    map: data.match.map,
    playedAt: data.match.playedAt ?? data.match.createdAt,
    roundsPlayed: data.match.roundsPlayed,
    mode: data.match.mode,
    status: data.match.status,
    score: perspectiveScore(data.match, me?.startingSide ?? 'CT'),
    hasPlayer: Boolean(me),
  }
}

const headFromList = (m: MatchListItem): MatchHead => ({
  map: m.map,
  playedAt: m.playedAt ?? m.discoveredAt,
  roundsPlayed: m.roundsPlayed,
  mode: m.mode,
  status: m.status,
  score: perspectiveScore(m, m.player?.startingSide ?? 'CT'),
  hasPlayer: Boolean(m.player?.startingSide),
})

/** The match as the lists already know it (sidebar "Recent", Matches page), if cached. */
const cachedHead = (queryClient: QueryClient, id: string) => {
  const caches = queryClient.getQueriesData<
    { items: MatchListItem[] } | { pages: { items: MatchListItem[] }[] }
  >({ queryKey: ['matches'] })
  for (const [, cache] of caches) {
    if (!cache) continue
    const items = 'pages' in cache ? cache.pages.flatMap((p) => p.items) : cache.items
    const found = items.find((m) => m.id === id)
    if (found) return headFromList(found)
  }
  return null
}

export const Route = createFileRoute('/_app/matches/$id')({
  // Not awaited: the page opens straight away on the header the lists already have, and the
  // rest fades in when the match arrives.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(matchQuery(params.id))
    return { preview: cachedHead(context.queryClient, params.id) }
  },
  validateSearch: clipViewerSearch,
  component: MatchPage,
})

const tabClass =
  'relative z-10 h-8 cursor-pointer rounded-lg px-3 text-sm text-muted transition-colors outline-none select-none hover:text-foreground data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

function MatchPage() {
  const { id } = Route.useParams()
  const { preview } = Route.useLoaderData()
  const { clip } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, error } = useQuery(matchQuery(id))
  if (error) throw error
  const head = data ? headFromDetail(data) : preview

  return (
    <div className="grid gap-10">
      <MatchHeader head={head} />
      <FadeSwap swapKey={data ? 'ready' : 'loading'} enterDelay={data ? 0 : 120}>
        {data ? <MatchBody data={data} /> : <BodySkeleton />}
      </FadeSwap>
      <ClipViewerDialog
        clipId={clip}
        source={{ match: id }}
        onSelect={(next) =>
          navigate({
            search: { clip: next },
            mask: clipMask(next),
            replace: true,
            resetScroll: false,
          })
        }
        onClose={() => navigate({ search: {}, resetScroll: false })}
      />
    </div>
  )
}

const BodySkeleton = () => (
  <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} className="aspect-video" />
    ))}
  </div>
)

function MatchHeader({ head }: { head: MatchHead | null }) {
  return (
    <div>
      <Link
        to="/matches"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Matches
      </Link>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-4">
        <FadeSwap swapKey={head ? 'ready' : 'pending'}>
          {head ? (
            <div className="flex items-center gap-4">
              <MapIcon map={head.map} className="size-14 text-2xl" />
              <div>
                <h1 className="font-serif text-4xl tracking-tight">{mapName(head.map)}</h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                  <span>{formatDate(head.playedAt)}</span>
                  {head.roundsPlayed !== null && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{head.roundsPlayed} rounds</span>
                    </>
                  )}
                  {head.mode && head.mode !== 'other' && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="capitalize">{head.mode}</span>
                    </>
                  )}
                  <MatchStatusBadge status={head.status} className="ml-1.5" />
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Skeleton className="size-14" />
              <div>
                <Skeleton className="h-10 w-48" />
                <Skeleton className="mt-1.5 h-5 w-56" />
              </div>
            </div>
          )}
        </FadeSwap>
        {head?.score && (
          <div className="flex justify-center border-t pt-6 transition-opacity duration-200 ease-out-quart starting:opacity-0 md:justify-end md:border-0 md:pt-0">
            {/* Equal side columns keep the colon (and the result under it) at the true center. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 font-mono text-4xl tabular-nums">
              <span
                className={cn(
                  'text-right',
                  head.hasPlayer && head.score.result === 'win' && 'text-success',
                  head.hasPlayer && head.score.result === 'loss' && 'text-danger',
                )}
              >
                {head.score.own}
              </span>
              <span className="text-muted">:</span>
              <span>{head.score.enemy}</span>
              {head.hasPlayer && (
                <span className="col-span-3 mt-3 text-center font-sans md:mt-1.5 text-sm text-muted capitalize">
                  {head.score.result}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchBody({ data }: { data: MatchDetail }) {
  const mySteamIds = new Set(data.viewerSteamId ? [data.viewerSteamId] : [])
  const myPlayer = data.players.find((p) => mySteamIds.has(p.steamId))
  const [scope, setScope] = useState<'mine' | 'all'>(myPlayer ? 'mine' : 'all')

  const highlights = data.highlights.filter((h) => scope === 'all' || mySteamIds.has(h.steamId))
  const clips = highlights.filter((h) => h.clip)
  const moments = highlights.filter((h) => !h.clip)
  const players = new Map(
    data.players.map((p) => [p.steamId, { name: p.name, avatarUrl: p.avatarUrl }]),
  )
  const playerOf = (steamId: string) => players.get(steamId) ?? { name: 'Unknown', avatarUrl: null }

  return (
    <div className="grid gap-10">
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl tracking-tight">Highlights</h2>
          {myPlayer && (
            <Tabs.Root value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <Tabs.List className="relative flex gap-1">
                <Tabs.Tab value="mine" className={tabClass}>
                  Yours
                </Tabs.Tab>
                <Tabs.Tab value="all" className={tabClass}>
                  Everyone
                </Tabs.Tab>
                <Tabs.Indicator className="absolute top-0 left-0 z-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-lg bg-surface-2 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
              </Tabs.List>
            </Tabs.Root>
          )}
        </div>
        {highlights.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted">
            {data.match.status === 'ready'
              ? 'No standout moments in this one.'
              : 'Highlights appear once the demo is analyzed.'}
          </p>
        ) : (
          <div className="grid gap-10">
            {clips.length > 0 && (
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                {clips.map((h) => (
                  <HighlightCard
                    key={h.id}
                    highlight={{ ...h, clip: h.clip!, map: data.match.map }}
                    player={playerOf(h.steamId)}
                    context={`Round ${h.round}`}
                  />
                ))}
              </div>
            )}
            {moments.length > 0 && (
              // Long titles truncate instead of widening the page.
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-medium text-muted">
                  {clips.length > 0 ? 'More moments' : 'Moments'} · not recorded yet
                </h3>
                <div className="-mx-4 border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
                  {moments.map((m) => (
                    <MomentRow
                      key={m.id}
                      moment={m}
                      match={data}
                      player={scope === 'all' ? playerOf(m.steamId) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {data.rounds.length > 0 && (
        <RoundTimeline
          data={data}
          viewerSteamId={myPlayer?.steamId}
          viewerTeam={myPlayer?.startingSide}
        />
      )}
      {data.players.length > 0 && <Scoreboard data={data} viewerSteamId={data.viewerSteamId} />}
    </div>
  )
}
