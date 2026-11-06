import { SIDES } from '@subtick/domain'
import { memo, useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { partyMarkers } from '@/lib/party'
import type { MatchDetail } from '@/lib/queries'
import { ScrollTable } from './cells'
import { teamScore } from './columns'
import { DetailedTable } from './detailed-table'
import { OverviewTable, overviewRanges } from './overview-table'
import { type View, useScoreboardSorting } from './sorting'
import { type Team, TeamSummary } from './team-header'

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'detailed', label: 'Detailed' },
] as const

/** Memoized: the match page re-renders around it (the highlights' scope tabs) on the same data. */
export const Scoreboard = memo(function Scoreboard({
  data,
  viewerSteamId,
}: {
  data: MatchDetail
  viewerSteamId: string | null
}) {
  const [view, setView] = useState<View>('overview')
  const { rows, sortOf, toggleSort } = useScoreboardSorting(data.players, view)

  const parties = partyMarkers(data.players)
  const ranges = overviewRanges(data.players)
  const best = data.players.toSorted((a, b) => b.stats.rating - a.stats.rating)[0]
  const mvp = best?.steamId
  const bestRating = best?.stats.rating ?? 0
  const viewerTeam = data.players.find((p) => p.steamId === viewerSteamId)?.startingSide

  const teams = SIDES.map((side) => ({
    side,
    players: rows.filter((p) => p.startingSide === side),
  }))
    // The viewer's team first, otherwise the winner.
    .toSorted((a, b) => {
      if (viewerTeam) return a.side === viewerTeam ? -1 : 1

      return teamScore(data, b.side) - teamScore(data, a.side)
    })

  const summary = (team: Team) => <TeamSummary data={data} team={team} viewerTeam={viewerTeam} />

  return (
    // min-w-0: grid items default to their content's width, and the wide table would push the page.
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-heading tracking-tight">Scoreboard</h2>
        <Segmented label="Scoreboard view" value={view} options={VIEWS} onChange={setView} />
      </div>
      <ScrollTable>
        {view === 'overview' ? (
          <OverviewTable
            teams={teams}
            summary={summary}
            ranges={ranges}
            parties={parties}
            viewerSteamId={viewerSteamId}
            sortOf={sortOf}
            toggleSort={toggleSort}
          />
        ) : (
          <DetailedTable
            teams={teams}
            summary={summary}
            parties={parties}
            viewerSteamId={viewerSteamId}
            sortOf={sortOf}
            toggleSort={toggleSort}
            bestRating={bestRating}
            mvp={mvp}
          />
        )}
      </ScrollTable>
    </section>
  )
})
