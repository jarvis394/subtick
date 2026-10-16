import { type Side, ROUNDS_PER_HALF, REGULATION_ROUNDS, SIDES } from '@subtick/domain'
import { ChevronDown, Star } from 'lucide-react'
import { useState } from 'react'
import { PartyMarker } from '@/components/party-marker'
import { RankBadge } from '@/components/rank-badge'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/surface'
import { partyMarkers } from '@/lib/party'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Player = MatchDetail['players'][number]

interface Column {
  id: string
  label: string
  title?: string
  value: (p: Player) => number
  format?: (n: number) => string
  /** Lower is better (deaths): colors and sorting flip. */
  inverse?: boolean
  muted?: boolean
}

const fixed = (digits: number) => (n: number) => n.toFixed(digits)
const per = (a: number, b: number) => (b ? a / b : a)

const COLUMNS: Column[] = [
  { id: 'kills', label: 'K', title: 'Kills', value: (p) => p.stats.kills },
  {
    id: 'deaths',
    label: 'D',
    title: 'Deaths',
    value: (p) => p.stats.deaths,
    inverse: true,
    muted: true,
  },
  { id: 'assists', label: 'A', title: 'Assists', value: (p) => p.stats.assists, muted: true },
  {
    id: 'adr',
    label: 'ADR',
    title: 'Average damage per round',
    value: (p) => p.stats.adr,
    format: fixed(1),
  },
  { id: 'kd', label: 'K/D', value: (p) => per(p.stats.kills, p.stats.deaths), format: fixed(2) },
  {
    id: 'kr',
    label: 'K/R',
    title: 'Kills per round',
    value: (p) => per(p.stats.kills, p.stats.roundsPlayed),
    format: fixed(2),
  },
  {
    id: 'kast',
    label: 'KAST',
    title: 'Rounds with a kill, assist, survival or trade',
    value: (p) => p.stats.kastPercent,
    format: (n) => `${n.toFixed(1)}%`,
  },
  {
    id: 'hs',
    label: 'HS',
    title: 'Headshot kills',
    value: (p) => p.stats.headshotKills,
    muted: true,
  },
  {
    id: 'hsp',
    label: 'HS%',
    value: (p) => p.stats.hsPercent,
    format: (n) => `${n.toFixed(1)}%`,
    muted: true,
  },
  { id: 'fk', label: 'FK', title: 'Opening kills', value: (p) => p.stats.openingKills },
  { id: '5k', label: '5k', value: (p) => p.stats.multiKills[4] },
  { id: '4k', label: '4k', value: (p) => p.stats.multiKills[3] },
  { id: '3k', label: '3k', value: (p) => p.stats.multiKills[2] },
  { id: '2k', label: '2k', value: (p) => p.stats.multiKills[1] },
  { id: 'clutches', label: 'Clutch', title: 'Clutches won', value: (p) => p.stats.clutchesWon },
]

/** Columns holding decimals or percentages. */
const WIDE_COLUMNS = new Set(['adr', 'kast', 'hsp', 'clutches'])

const RATING: Column = {
  id: 'rating',
  label: 'Rating',
  title: 'HLTV 1.0 rating',
  value: (p) => p.stats.rating,
  format: fixed(2),
}
const SORTABLE = [RATING, ...COLUMNS]

const ratingTone = (rating: number) =>
  rating >= 1.3
    ? 'bg-success/20 text-success'
    : rating >= 1
      ? 'bg-surface-3 text-foreground'
      : rating >= 0.85
        ? 'bg-surface-3 text-muted'
        : 'bg-danger/20 text-danger'

/**
 * Cell layout. The <td> stays transparent and only provides the gap (transparent left padding);
 * an inner block carries the background and rounding. Groups per row: [avatar + name] [rank]
 * [rating] [all stats as one band]. Using padding instead of table border-spacing keeps pinned
 * columns at exact offsets with nothing between them for scrolled cells to show through.
 */
interface Shape {
  /** Gap before this cell: starts a new island. */
  gap?: boolean
  round?: 'all' | 'left' | 'right' | 'none' | 'edge-left' | 'edge-right'
  /** Pinned: gets an opaque page-colored backing so nothing shows through rounded corners. */
  sticky?: string
}

const ROUND = {
  all: 'rounded-md',
  left: 'rounded-l-md',
  right: 'rounded-r-md',
  none: '',
  // The row's outer ends: square on phones, where the table runs edge to edge.
  'edge-left': 'md:rounded-l-md',
  'edge-right': 'md:rounded-r-md',
}

const shell = ({ gap, sticky }: Shape) =>
  cn('p-0', gap && 'pl-[3px]', sticky && cn(sticky, 'bg-background'))
const block = ({ round = 'all' }: Shape, head: boolean, className?: string) =>
  cn('flex items-center', head ? 'h-9 bg-surface-2' : 'h-11 bg-surface', ROUND[round], className)

/**
 * Pinned while the table scrolls sideways: on phones only the party symbol and avatar (the name
 * would cover half the screen), from md up the name too.
 */
const IDENTITY: Shape = { round: 'edge-left', sticky: 'sticky left-0 z-10' }
const NAME: Shape = { round: 'right', sticky: 'md:sticky md:left-[4.25rem] md:z-10' }
const RANK: Shape = { gap: true }
const RATING_SHAPE: Shape = { gap: true }
const statShape = (index: number): Shape => ({
  gap: index === 0,
  round: index === 0 ? 'left' : index === COLUMNS.length - 1 ? 'edge-right' : 'none',
})

/**
 * Rating with a faint, uncolored fill behind it: full width for the match's best rating,
 * shrinking proportionally for everyone else.
 */
const RatingCell = ({ rating, best, mvp }: { rating: number; best: number; mvp: boolean }) => (
  <td className={shell(RATING_SHAPE)}>
    <div className={block(RATING_SHAPE, false, 'relative overflow-hidden px-2.5')}>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-foreground/[0.05]"
        style={{ width: `${best > 0 ? Math.max(rating / best, 0) * 100 : 0}%` }}
      />
      <span className="relative flex items-center gap-1.5">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-mono text-[13px] font-semibold',
            ratingTone(rating),
          )}
        >
          {rating.toFixed(2)}
        </span>
        {mvp && <Star className="size-3.5 fill-accent text-accent" aria-label="Match MVP" />}
      </span>
    </div>
  </td>
)

/** Team score per half: rounds 1–12, 13–24, then overtime. */
const halfScores = (rounds: MatchDetail['rounds'], team: Side) => {
  const won = (from: number, to: number) =>
    rounds.filter((r) => r.number >= from && r.number <= to && r.winnerTeam === team).length
  const overtime = rounds.length > REGULATION_ROUNDS ? won(REGULATION_ROUNDS + 1, Infinity) : null
  return {
    first: won(1, ROUNDS_PER_HALF),
    second: won(ROUNDS_PER_HALF + 1, REGULATION_ROUNDS),
    overtime,
  }
}

/** Mean CS Rating of a team's placed Premier players. */
const averagePremier = (team: Player[]) => {
  const ratings = team.flatMap((p) =>
    p.rank?.mode === 'premier' && p.rank.after > 0 ? [p.rank.after] : [],
  )
  return ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null
}

const HeaderCell = ({
  column,
  shape,
  sortKey,
  onSort,
  className,
}: {
  column: Column
  shape: Shape
  sortKey: string
  onSort: (id: string) => void
  className?: string
}) => (
  <th className={shell(shape)} title={column.title}>
    <div className={block(shape, true, className)}>
      <button
        type="button"
        onClick={() => onSort(column.id)}
        className={cn(
          'inline-flex cursor-pointer items-center gap-0.5 font-medium outline-none hover:text-foreground focus-visible:text-foreground',
          sortKey === column.id && 'text-foreground',
        )}
      >
        {column.label}
        {sortKey === column.id && <ChevronDown className="size-3" />}
      </button>
    </div>
  </th>
)

export const Scoreboard = ({
  data,
  viewerSteamId,
}: {
  data: MatchDetail
  viewerSteamId: string | null
}) => {
  const [sortKey, setSortKey] = useState('rating')
  const sortColumn = SORTABLE.find((c) => c.id === sortKey) ?? RATING
  const sort = (players: Player[]) =>
    players.toSorted((a, b) =>
      sortColumn.inverse
        ? sortColumn.value(a) - sortColumn.value(b)
        : sortColumn.value(b) - sortColumn.value(a),
    )

  const parties = partyMarkers(data.players)
  const best = data.players.toSorted((a, b) => b.stats.rating - a.stats.rating)[0]
  const mvp = best?.steamId
  const bestRating = best?.stats.rating ?? 0
  const viewerTeam = data.players.find((p) => p.steamId === viewerSteamId)?.startingSide
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
      <h2 className="mb-4 font-serif text-xl tracking-tight">Scoreboard</h2>
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
                    'font-mono text-2xl tabular-nums',
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
                <span className="ml-auto flex items-center gap-4 text-[13px] text-muted">
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

              <div className="-mx-4 overflow-x-auto select-text md:mx-0">
                {/* Fixed widths so both teams line up; rows are separated vertically only. */}
                <table className="w-full min-w-[68rem] table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-[13px] tabular-nums">
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
                  </colgroup>
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      <th className={shell(IDENTITY)} aria-label="Party and avatar">
                        <div className={block(IDENTITY, true)} />
                      </th>
                      <th className={shell(NAME)}>
                        <div className={block(NAME, true, 'font-medium')}>Player</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.steamId}>
                        <td className={shell(IDENTITY)}>
                          <div className={block(IDENTITY, false, 'gap-2 pl-2.5')}>
                            <PartyMarker marker={parties.get(p.steamId)} />
                            <Avatar src={p.avatarUrl} name={p.name} className="size-7" />
                          </div>
                        </td>
                        <td className={shell(NAME)}>
                          <div className={block(NAME, false, 'min-w-0 gap-2 pr-2.5')}>
                            <span className="truncate font-medium">{p.name}</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const teamScore = (data: MatchDetail, side: Side) =>
  (side === 'CT' ? data.match.scoreStartedCt : data.match.scoreStartedT) ?? 0
