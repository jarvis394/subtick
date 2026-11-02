import { SIDES } from '@subtick/domain'
import { Users } from 'lucide-react'
import { memo, useState } from 'react'
import { PartyMarker } from '@/components/party-marker'
import { PlayerAvatarLink, PlayerLink } from '@/components/player-link'
import { RankBadge } from '@/components/rank-badge'
import { Badge } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import { partyMarkers } from '@/lib/party'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'
import {
  EndCap,
  EndCapHead,
  HeaderCell,
  IDENTITY,
  NAME,
  RANK,
  RATING_SHAPE,
  RatingCell,
  ScrollTable,
  block,
  shell,
  statShape,
} from './cells'
import {
  COLUMNS,
  type Player,
  RATING,
  SORTABLE,
  WIDE_COLUMNS,
  averagePremier,
  halfScores,
  teamScore,
} from './columns'

/** Memoized: the match page re-renders around it (the highlights' scope tabs) on the same data. */
export const Scoreboard = memo(function Scoreboard({
  data,
  viewerSteamId,
}: {
  data: MatchDetail
  viewerSteamId: string | null
}) {
  const [sortKey, setSortKey] = useState('rating')
  const sortColumn = SORTABLE.find((c) => c.id === sortKey) ?? RATING

  const parties = partyMarkers(data.players)
  const best = data.players.toSorted((a, b) => b.stats.rating - a.stats.rating)[0]
  const mvp = best?.steamId
  const bestRating = best?.stats.rating ?? 0
  const viewerTeam = data.players.find((p) => p.steamId === viewerSteamId)?.startingSide

  const sort = (players: Player[]) =>
    players.toSorted((a, b) =>
      sortColumn.inverse
        ? sortColumn.value(a) - sortColumn.value(b)
        : sortColumn.value(b) - sortColumn.value(a),
    )

  const teams = SIDES.map((side) => ({
    side,
    players: sort(data.players.filter((p) => p.startingSide === side)),
  }))
    // The viewer's team first, otherwise the winner.
    .toSorted((a, b) => {
      if (viewerTeam) return a.side === viewerTeam ? -1 : 1

      return teamScore(data, b.side) - teamScore(data, a.side)
    })

  return (
    // min-w-0: grid items default to their content's width, and the wide table would push the page.
    <section className="min-w-0">
      <h2 className="mb-4 font-serif text-heading tracking-tight">Scoreboard</h2>
      <div className="grid min-w-0 gap-8">
        {teams.map(({ side, players }) => {
          const score = teamScore(data, side)
          const enemy = teamScore(data, side === 'CT' ? 'T' : 'CT')
          const halves = halfScores(data.rounds, side)
          const avg = averagePremier(players)
          const label = viewerTeam
            ? side === viewerTeam
              ? 'Your team'
              : 'Opponents'
            : `Team ${players[0]?.name ?? side}`

          return (
            <div key={side} className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span
                  className={cn(
                    'font-mono text-section tabular-nums',
                    score > enemy
                      ? 'text-success'
                      : score < enemy
                        ? 'text-danger'
                        : 'text-foreground',
                  )}
                >
                  {score}
                </span>
                <span className="font-medium">{label}</span>
                <Badge tone={side === 'CT' ? 'ct' : 't'}>Started {side}</Badge>
                <span className="ml-auto flex items-center gap-4 text-small text-muted">
                  {avg !== null && (
                    <span className="flex items-center gap-2">
                      Team avg
                      <RankBadge
                        rank={{ mode: 'premier', before: avg, after: avg, change: 0, wins: 0 }}
                        showChange={false}
                      />
                    </span>
                  )}
                  <span>
                    First half <span className="font-medium text-foreground">{halves.first}</span>
                  </span>
                  <span>
                    Second half <span className="font-medium text-foreground">{halves.second}</span>
                  </span>
                  {halves.overtime !== null && (
                    <span>
                      OT <span className="font-medium text-foreground">{halves.overtime}</span>
                    </span>
                  )}
                </span>
              </div>

              <ScrollTable>
                {/* Fixed widths so both teams line up; rows are separated vertically only. */}
                <table className="w-full min-w-[68rem] table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-small tabular-nums">
                  <colgroup>
                    <col className="w-[4.25rem]" />
                    <col className="w-[12rem]" />
                    <col className="w-[9.5rem]" />
                    <col className="w-[6.75rem]" />
                    {COLUMNS.map((c) => (
                      <col
                        key={c.id}
                        className={WIDE_COLUMNS.has(c.id) ? 'w-[5rem]' : 'w-[3.5rem]'}
                      />
                    ))}
                    <col className="w-0" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-label text-muted">
                      <th className={shell(IDENTITY)} aria-label="Party and avatar">
                        <div className={block(IDENTITY, true, 'pl-2.5')}>
                          <Tooltip
                            content="Party"
                            trigger={
                              <span className="grid w-3 place-items-center">
                                <Users className="size-3" aria-hidden />
                              </span>
                            }
                          />
                        </div>
                      </th>
                      <th className={shell(NAME)}>
                        <div className={block(NAME, true, 'pl-3 font-medium md:pl-0')}>Player</div>
                      </th>
                      <th className={shell(RANK)}>
                        <div className={block(RANK, true, 'px-2.5 font-medium')}>Rank</div>
                      </th>
                      <HeaderCell
                        column={RATING}
                        shape={RATING_SHAPE}
                        sortKey={sortKey}
                        onSort={setSortKey}
                        className="px-2.5"
                      />
                      {COLUMNS.map((c, i) => (
                        <HeaderCell
                          key={c.id}
                          column={c}
                          shape={statShape(i)}
                          sortKey={sortKey}
                          onSort={setSortKey}
                          className="justify-end px-3"
                        />
                      ))}
                      <EndCapHead />
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.steamId}>
                        <td className={shell(IDENTITY)}>
                          <div className={block(IDENTITY, false, 'gap-2 pl-2.5')}>
                            <PartyMarker marker={parties.get(p.steamId)} />
                            <PlayerAvatarLink
                              steamId={p.steamId}
                              vanity={p.vanity}
                              src={p.avatarUrl}
                              name={p.name}
                              className="size-7"
                            />
                          </div>
                        </td>
                        <td className={shell(NAME)}>
                          <div className={block(NAME, false, 'min-w-0 gap-2 pr-2.5 pl-3 md:pl-0')}>
                            <PlayerLink
                              steamId={p.steamId}
                              vanity={p.vanity}
                              className="truncate font-medium hover:text-foreground/80"
                            >
                              {p.name}
                            </PlayerLink>
                            {p.steamId === viewerSteamId && (
                              <Badge tone="accent" className="shrink-0">
                                Me
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={shell(RANK)}>
                          <div className={block(RANK, false, 'px-2.5 whitespace-nowrap')}>
                            <RankBadge rank={p.rank} />
                          </div>
                        </td>
                        <RatingCell
                          rating={p.stats.rating}
                          best={bestRating}
                          mvp={p.steamId === mvp}
                        />
                        {COLUMNS.map((c, i) => {
                          const value = c.value(p)

                          return (
                            <td key={c.id} className={shell(statShape(i))}>
                              <div
                                className={block(
                                  statShape(i),
                                  false,
                                  cn(
                                    'justify-end px-3',
                                    value === 0
                                      ? 'text-muted/40'
                                      : c.muted
                                        ? 'text-muted'
                                        : 'text-foreground',
                                    c.id === sortKey && 'font-semibold',
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
                </table>
              </ScrollTable>
            </div>
          )
        })}
      </div>
    </section>
  )
})
