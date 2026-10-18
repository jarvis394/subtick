import { ScrollArea } from '@base-ui/react/scroll-area'
import { type Side, ROUNDS_PER_HALF, REGULATION_ROUNDS, SIDES } from '@subtick/domain'
import { ChevronDown, Star, Users } from 'lucide-react'
import { type ReactNode, useState } from 'react'
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
  /** Corner rounding of the cell's block (Tailwind classes, may be responsive). */
  round?: string
  /** Extra classes on the <td>/<th> (pinning). */
  pin?: string
}

const shell = ({ gap, pin }: Shape) => cn('p-0', gap && 'pl-[3px]', pin)
const block = ({ round = 'rounded-md' }: Shape, head: boolean, className?: string) =>
  cn('flex items-center', head ? 'h-9 bg-surface-2' : 'h-11 bg-surface', round, className)

/**
 * Pinned while the table scrolls sideways: on phones only the party symbol and avatar (the name
 * would cover half the screen), from md up the name too. The pinned part is always its own island:
 * an opaque page-colored backing hides scrolled cells behind rounded corners, and a page-colored
 * shadow keeps the 3px island gap on its right. Unscrolled, that shadow sits exactly on the next
 * cell's transparent gap, so nothing shifts when scrolling starts.
 */
// Written out in full (also below with md:): Tailwind only sees literal class names.
const PIN_GAP = 'shadow-[3px_0_0_var(--color-background)]'

/**
 * Scrolled cells are cut by a straight line at the pinned island's edge. These caps paint concave
 * 6px corners (page color outside a quarter circle) just past the gap, so cut cells look rounded
 * too. Unscrolled, they sit exactly on the next island's own rounded corners.
 * Class names are written out in full because Tailwind only sees literal strings.
 */
const CORNER_CAPS = cn(
  "before:pointer-events-none before:absolute before:bottom-0 before:-right-[9px] before:size-1.5 before:content-['']",
  'before:bg-[radial-gradient(circle_at_100%_0,transparent_5.5px,var(--color-background)_6px)]',
  "after:pointer-events-none after:absolute after:top-0 after:-right-[9px] after:size-1.5 after:content-['']",
  'after:bg-[radial-gradient(circle_at_100%_100%,transparent_5.5px,var(--color-background)_6px)]',
)
const MD_CORNER_CAPS = cn(
  "md:before:pointer-events-none md:before:absolute md:before:bottom-0 md:before:-right-[9px] md:before:size-1.5 md:before:content-['']",
  'md:before:bg-[radial-gradient(circle_at_100%_0,transparent_5.5px,var(--color-background)_6px)]',
  "md:after:pointer-events-none md:after:absolute md:after:top-0 md:after:-right-[9px] md:after:size-1.5 md:after:content-['']",
  'md:after:bg-[radial-gradient(circle_at_100%_100%,transparent_5.5px,var(--color-background)_6px)]',
)

/**
 * Right end of the scroll area (md+; phones run edge to edge). A zero-width cell pinned to the
 * right edge whose corner caps round the row where scrolled cells are cut by a straight line. At
 * the true end of the table they sit exactly on the last cell's own rounded corners.
 */
const END_CAPS = cn(
  'max-md:before:hidden max-md:after:hidden',
  "before:pointer-events-none before:absolute before:top-0 before:right-0 before:size-1.5 before:content-['']",
  'before:bg-[radial-gradient(circle_at_0_100%,transparent_5.5px,var(--color-background)_6px)]',
  "after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:size-1.5 after:content-['']",
  'after:bg-[radial-gradient(circle_at_0_0,transparent_5.5px,var(--color-background)_6px)]',
)
const EndCap = () => <td aria-hidden className={cn('sticky right-0 z-10 w-0 p-0', END_CAPS)} />
const EndCapHead = () => <th aria-hidden className={cn('sticky right-0 z-10 w-0 p-0', END_CAPS)} />

const IDENTITY: Shape = {
  // Phones: square on the screen edge, rounded on the right. md+: left end of the avatar+name island.
  round: 'rounded-r-md md:rounded-l-md md:rounded-r-none',
  pin: cn(
    'sticky left-0 z-10 bg-background',
    PIN_GAP,
    CORNER_CAPS,
    'md:shadow-none md:before:hidden md:after:hidden',
  ),
}
const NAME: Shape = {
  // Phones: its own island after the pinned avatar. md+: joined to the avatar, pinned with it.
  round: 'rounded-md md:rounded-l-none',
  pin: cn(
    'pl-[3px] md:sticky md:left-[4.25rem] md:z-10 md:bg-background md:pl-0',
    'md:shadow-[3px_0_0_var(--color-background)]',
    MD_CORNER_CAPS,
  ),
}
const RANK: Shape = { gap: true }
const RATING_SHAPE: Shape = { gap: true }
const statShape = (index: number): Shape => ({
  gap: index === 0,
  round:
    index === 0
      ? 'rounded-l-md'
      : // The row's right end: square on phones, where the table runs edge to edge.
        index === COLUMNS.length - 1
        ? 'md:rounded-r-md'
        : 'rounded-none',
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
        {mvp && <Star className="size-3.5 fill-brand text-brand" aria-label="Match MVP" />}
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

/**
 * Horizontal scroller with a Base UI scrollbar, shown while hovering or scrolling. The bar lives in
 * padding below the table (only while it overflows), so it never covers a row.
 */
const ScrollTable = ({ className, children }: { className?: string; children: ReactNode }) => (
  <ScrollArea.Root className={cn('data-has-overflow-x:pb-2', className)}>
    <ScrollArea.Viewport className="overscroll-x-none select-text">
      <ScrollArea.Content>{children}</ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar
      orientation="horizontal"
      className={cn(
        'absolute inset-x-4 bottom-0 flex h-1.5 items-center rounded-full bg-foreground/[0.04] md:inset-x-0',
        // Shown while the pointer is over the table or it's scrolling (touch has no hover).
        'opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100',
        'motion-reduce:transition-none',
      )}
    >
      <ScrollArea.Thumb className="h-full rounded-full bg-foreground/20 transition-colors hover:bg-foreground/30 active:bg-foreground/40" />
    </ScrollArea.Scrollbar>
  </ScrollArea.Root>
)

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

              {/* md+: only the table pokes out of the page's content width (headings stay put), by up to
                  2rem a side, always keeping 16px clear of the content area's edges (the 32px in the
                  calc). Negative margins, not an
                  explicit width: a wider grid item would stretch its auto track and push the table
                  off-center. `100%` is the track's width and `cqw` the shell's `@container`. */}
              <ScrollTable className="-mx-4 md:-mx-[clamp(0px,calc((100cqw_-_100%_-_32px)_/_2),2rem)]">
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
                    <col className="w-0" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      <th className={shell(IDENTITY)} aria-label="Party and avatar">
                        <div className={block(IDENTITY, true, 'pl-2.5')}>
                          <span className="grid w-3 place-items-center" title="Party">
                            <Users className="size-3" aria-hidden />
                          </span>
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
                            <Avatar src={p.avatarUrl} name={p.name} className="size-7" />
                          </div>
                        </td>
                        <td className={shell(NAME)}>
                          <div className={block(NAME, false, 'min-w-0 gap-2 pr-2.5 pl-3 md:pl-0')}>
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
}

const teamScore = (data: MatchDetail, side: Side) =>
  (side === 'CT' ? data.match.scoreStartedCt : data.match.scoreStartedT) ?? 0
