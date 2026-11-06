import type { ReactNode } from 'react'
import type { PartyMarker } from '@/lib/party'
import { cn } from '@/lib/utils'
import {
  EndCap,
  EndCapHead,
  HeaderCell,
  RATING_SHAPE,
  RatingCell,
  block,
  shell,
  statShape,
} from './cells'
import { COLUMNS, RATING, WIDE_COLUMNS } from './columns'
import { IdentityCells, IdentityHeads } from './identity'
import { type Team, TeamHeaderRow } from './team-header'

/** Every counting stat, for reading a match closely. */
export const DetailedTable = ({
  teams,
  summary,
  parties,
  viewerSteamId,
  sortOf,
  toggleSort,
  bestRating,
  mvp,
}: {
  teams: Team[]
  summary: (team: Team) => ReactNode
  parties: Map<string, PartyMarker>
  viewerSteamId: string | null
  sortOf: (id: string) => false | 'asc' | 'desc'
  toggleSort: (id: string) => void
  bestRating: number
  mvp: string | undefined
}) => (
  // One table for both teams so their columns line up; Rank (w-px) shrinks to its widest badge and
  // the narrow stat columns, without widths, take what is left.
  <table className="w-full min-w-[82rem] border-separate border-spacing-x-0 border-spacing-y-[3px] text-small tabular-nums">
    <colgroup>
      <col className="w-[4.25rem]" />
      <col className="w-[12rem]" />
      <col className="w-px" />
      <col className="w-[6.75rem]" />
      {COLUMNS.map((c) => (
        <col key={c.id} className={WIDE_COLUMNS.has(c.id) ? 'w-[5rem]' : undefined} />
      ))}
      <col className="w-0" />
    </colgroup>
    {teams.map((team, i) => (
      <tbody key={team.side}>
        <TeamHeaderRow colSpan={COLUMNS.length + 5} first={i === 0}>
          {summary(team)}
        </TeamHeaderRow>
        <tr className="text-left text-label text-muted">
          <IdentityHeads />
          <HeaderCell
            column={RATING}
            shape={RATING_SHAPE}
            sort={sortOf(RATING.id)}
            onSort={() => toggleSort(RATING.id)}
            className="px-2.5"
          />
          {COLUMNS.map((c, j) => (
            <HeaderCell
              key={c.id}
              column={c}
              shape={statShape(j)}
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
            <RatingCell rating={p.stats.rating} best={bestRating} mvp={p.steamId === mvp} />
            {COLUMNS.map((c, j) => {
              const value = c.value(p) ?? 0

              return (
                <td key={c.id} className={shell(statShape(j))}>
                  <div
                    className={block(
                      statShape(j),
                      false,
                      cn(
                        'px-3',
                        value === 0 ? 'text-muted/40' : c.muted ? 'text-muted' : 'text-foreground',
                      ),
                    )}
                  >
                    {c.format ? c.format(value) : value}
                  </div>
                </td>
              )
            })}
            <EndCap />
          </tr>
        ))}
      </tbody>
    ))}
  </table>
)
