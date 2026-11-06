import type { ReactNode } from 'react'
import type { PartyMarker } from '@/lib/party'
import { EndCap, EndCapHead, HeaderCell, OVERVIEW_SHAPE, OverviewCell, type Range } from './cells'
import { OVERVIEW, type Player } from './columns'
import { IdentityCells, IdentityHeads } from './identity'
import { type Team, TeamHeaderRow } from './team-header'

/** Lowest and highest value of each overview column across the whole match. */
export const overviewRanges = (players: Player[]) =>
  new Map(
    OVERVIEW.map((c): [string, Range] => {
      const values = players.flatMap((p) => {
        const v = c.value(p)

        return v === null ? [] : [v]
      })

      return [c.id, { min: Math.min(...values), max: Math.max(...values) }]
    }),
  )

/** The default view: a few summary numbers, each judged against the match. */
export const OverviewTable = ({
  teams,
  summary,
  ranges,
  parties,
  viewerSteamId,
  sortOf,
  toggleSort,
}: {
  teams: Team[]
  summary: (team: Team) => ReactNode
  ranges: Map<string, Range>
  parties: Map<string, PartyMarker>
  viewerSteamId: string | null
  sortOf: (id: string) => false | 'asc' | 'desc'
  toggleSort: (id: string) => void
}) => (
  // One table for both teams so their columns line up; Rank (w-px) shrinks to its widest badge.
  <table className="w-full min-w-[52rem] border-separate border-spacing-x-0 border-spacing-y-[3px] text-small tabular-nums">
    <colgroup>
      <col className="w-[4.25rem]" />
      <col className="w-[12rem]" />
      <col className="w-px" />
      {OVERVIEW.map((c) => (
        <col key={c.id} />
      ))}
      <col className="w-0" />
    </colgroup>
    {teams.map((team, i) => (
      <tbody key={team.side}>
        <TeamHeaderRow colSpan={OVERVIEW.length + 4} first={i === 0}>
          {summary(team)}
        </TeamHeaderRow>
        <tr className="text-left text-label text-muted">
          <IdentityHeads />
          {OVERVIEW.map((c) => (
            <HeaderCell
              key={c.id}
              column={c}
              shape={OVERVIEW_SHAPE}
              sort={sortOf(c.id)}
              onSort={() => toggleSort(c.id)}
              className="px-3"
            />
          ))}
          <EndCapHead />
        </tr>
        {team.players.map((p) => (
          <tr key={p.steamId}>
            <IdentityCells
              player={p}
              marker={parties.get(p.steamId)}
              isViewer={p.steamId === viewerSteamId}
            />
            {OVERVIEW.map((c) => (
              <OverviewCell key={c.id} column={c} value={c.value(p)} range={ranges.get(c.id)!} />
            ))}
            <EndCap />
          </tr>
        ))}
      </tbody>
    ))}
  </table>
)
