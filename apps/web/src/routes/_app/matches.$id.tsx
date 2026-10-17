import { Tabs } from '@base-ui/react/tabs'
import { mapName } from '@subtick/domain'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { HighlightCard } from '@/components/highlight-card'
import { MapIcon } from '@/components/map-icon'
import { perspectiveScore } from '@/components/match-table'
import { MatchStatusBadge } from '@/components/match-status'
import { MomentRow } from '@/components/moment-row'
import { RoundTimeline } from '@/components/round-timeline'
import { Scoreboard } from '@/components/scoreboard'
import { formatDate } from '@/lib/format'
import { matchQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/matches/$id')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(matchQuery(params.id)),
  component: MatchPage,
})

const tabClass =
  'h-8 cursor-pointer rounded-lg px-3 text-sm text-muted transition-colors outline-none select-none hover:text-foreground data-active:bg-surface-2 data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

function MatchPage() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(matchQuery(id))
  const mySteamIds = new Set(data.viewerSteamId ? [data.viewerSteamId] : [])
  const myPlayer = data.players.find((p) => mySteamIds.has(p.steamId))
  const [scope, setScope] = useState<'mine' | 'all'>(myPlayer ? 'mine' : 'all')

  const score = perspectiveScore(data.match, myPlayer?.startingSide ?? 'CT')
  const highlights = data.highlights.filter((h) => scope === 'all' || mySteamIds.has(h.steamId))
  const clips = highlights.filter((h) => h.clip)
  const moments = highlights.filter((h) => !h.clip)
  const players = new Map(
    data.players.map((p) => [p.steamId, { name: p.name, avatarUrl: p.avatarUrl }]),
  )
  const playerOf = (steamId: string) => players.get(steamId) ?? { name: 'Unknown', avatarUrl: null }

  return (
    <div className="grid gap-10">
      <div>
        <Link
          to="/matches"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Matches
        </Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-4">
          <div className="flex items-center gap-4">
            <MapIcon map={data.match.map} className="size-14 text-2xl" />
            <div>
              <h1 className="font-serif text-4xl tracking-tight">{mapName(data.match.map)}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                <span>{formatDate(data.match.playedAt ?? data.match.createdAt)}</span>
                {data.match.roundsPlayed !== null && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{data.match.roundsPlayed} rounds</span>
                  </>
                )}
                {data.match.mode && data.match.mode !== 'other' && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{data.match.mode}</span>
                  </>
                )}
                <MatchStatusBadge status={data.match.status} className="ml-1.5" />
              </p>
            </div>
          </div>
          {score && (
            <div className="flex justify-center border-t pt-6 md:justify-end md:border-0 md:pt-0">
              {/* Equal side columns keep the colon (and the result under it) at the true center. */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 font-mono text-4xl tabular-nums">
                <span
                  className={cn('text-right', myPlayer && score.result === 'win' && 'text-success')}
                >
                  {score.own}
                </span>
                <span className="text-muted">:</span>
                <span>{score.enemy}</span>
                {myPlayer && (
                  <span className="col-span-3 mt-3 text-center font-sans md:mt-1.5 text-sm text-muted capitalize">
                    {score.result}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl tracking-tight">Highlights</h2>
          {myPlayer && (
            <Tabs.Root value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <Tabs.List className="flex gap-1">
                <Tabs.Tab value="mine" className={tabClass}>
                  Yours
                </Tabs.Tab>
                <Tabs.Tab value="all" className={tabClass}>
                  Everyone
                </Tabs.Tab>
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
