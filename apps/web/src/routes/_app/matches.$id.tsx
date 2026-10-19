import { Tabs } from '@base-ui/react/tabs'
import { mapName } from '@subtick/domain'
import { type QueryClient, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CircleStop, Plus, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { FadeSwap } from '@/components/fade-swap'
import { HighlightCard } from '@/components/highlight-card'
import { MapIcon } from '@/components/map-icon'
import { perspectiveScore } from '@/components/match-table'
import { MatchStatusBadge, isProcessing } from '@/components/match-status'
import { MomentRow } from '@/components/moment-row'
import { RoundTimeline } from '@/components/round-timeline'
import { Scoreboard } from '@/components/scoreboard'
import { Button } from '@/components/ui/button'
import { AutoHeight, FadeItem, FadeList, Presence } from '@/components/ui/presence'
import { Skeleton } from '@/components/ui/surface'
import { useCancelMatch, useRetryMatch } from '@/hooks/use-match-actions'
import { useMatchProgress } from '@/hooks/use-match-events'
import { formatDate } from '@/lib/format'
import { clipMask, clipViewerSearch } from '@/lib/highlights'
import { type MatchDetail, type MatchListItem, matchQuery, meQuery } from '@/lib/queries'
import { markSeen } from '@/lib/new-matches'
import { cn } from '@/lib/utils'

/** Everything the page header shows, so it can render before the full match has loaded. */
interface MatchHead {
  map: string | null
  playedAt: Date | string | null
  roundsPlayed: number | null
  mode: string | null
  status: MatchListItem['status']
  cancelled: boolean
  /** The viewer played it (so may stop or restart it). */
  mine: boolean
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
    cancelled: data.match.cancelled,
    mine: data.viewerSteamId !== null,
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
  cancelled: m.cancelled,
  mine: true,
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
  useEffect(() => markSeen(id), [id])
  const { preview } = Route.useLoaderData()
  const { clip } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, error } = useQuery(matchQuery(id))
  if (error) throw error
  const head = data ? headFromDetail(data) : preview

  return (
    <div className="grid gap-10">
      <MatchHeader id={id} head={head} />
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

function MatchHeader({ id, head }: { id: string; head: MatchHead | null }) {
  const { data: me } = useSuspenseQuery(meQuery)
  const retry = useRetryMatch({ inlineError: true })
  const cancel = useCancelMatch({ inlineError: true })
  const progress = useMatchProgress(id, head?.status ?? 'ready')
  const canManage = Boolean(head && (head.mine || me.user.isAdmin))
  const canRetry = canManage && head && (head.status === 'failed' || head.status === 'expired')
  const canCancel = canManage && head && isProcessing(head.status)
  const error = retry.error ?? cancel.error

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
                  <MatchStatusBadge
                    status={head.status}
                    cancelled={head.cancelled}
                    progress={progress}
                    className="ml-1.5"
                  />
                  {canRetry && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-1"
                      onClick={() => retry.mutate(id)}
                      loading={retry.isPending}
                    >
                      <RotateCw /> {head.cancelled ? 'Resume' : 'Retry'}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="danger"
                      className="ml-1"
                      onClick={() => cancel.mutate(id)}
                      loading={cancel.isPending}
                    >
                      <CircleStop /> Cancel
                    </Button>
                  )}
                </p>
                {error && (
                  <p className="mt-1.5 text-sm text-danger">
                    {error.message === 'forbidden'
                      ? 'Only players who imported this match can change its processing.'
                      : 'Something went wrong. Try again in a moment.'}
                  </p>
                )}
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
  // Asked for and not out yet; candidates are picked on the Create highlights page.
  // In the order the recorder works through them (demo order).
  const queue = highlights
    .filter((h) => !h.clip && (h.status === 'queued' || h.status === 'failed'))
    .toSorted((a, b) => a.startTick - b.startTick)
  const canCreate = data.highlights.some((h) => h.status === 'candidate')
  const players = new Map(
    data.players.map((p) => [p.steamId, { name: p.name, avatarUrl: p.avatarUrl }]),
  )
  const playerOf = (steamId: string) => players.get(steamId) ?? { name: 'Unknown', avatarUrl: null }

  return (
    <div className="grid gap-10">
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl tracking-tight">Highlights</h2>
          <div className="flex items-center gap-3">
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                render={<Link to="/matches/$id/create" params={{ id: data.match.id }} />}
              >
                <Plus />
                {/* One flex item, so the button's gap doesn't widen the space before "more". */}
                <span>
                  Create<span className="max-sm:hidden"> more</span>
                </span>
              </Button>
            )}
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
        </div>
        {clips.length === 0 && queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted">
            {data.match.status !== 'ready'
              ? 'Highlights appear once the demo is analyzed.'
              : canCreate
                ? 'Nothing recorded yet.'
                : 'No standout moments in this match.'}
          </p>
        ) : (
          // No gap: the Queue's box stays (at no height) while empty, so it spaces itself.
          <div className="grid">
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
            {/* Cancelled and recorded moments fade out; the block goes with the last one. */}
            <Presence show={queue.length > 0}>
              {/* Long titles truncate instead of widening the page. */}
              <div className={cn('min-w-0', clips.length > 0 && 'pt-10')}>
                <h3 className="mb-2 text-sm font-medium text-muted">Queue</h3>
                {/* Eases to its new height as rows come and go, so the border never jumps. */}
                <AutoHeight className="-mx-4 border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
                  <FadeList>
                    {queue.map((m) => (
                      <FadeItem key={m.id} className="border-b last:border-0">
                        <MomentRow
                          moment={m}
                          match={data}
                          player={scope === 'all' ? playerOf(m.steamId) : undefined}
                          owner={playerOf(m.steamId)}
                        />
                      </FadeItem>
                    ))}
                  </FadeList>
                </AutoHeight>
              </div>
            </Presence>
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
