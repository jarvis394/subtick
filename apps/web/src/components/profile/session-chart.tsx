import { ScrollArea } from '@base-ui/react/scroll-area'
import { mapName, summarize } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import {
  type CSSProperties,
  Fragment,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { MapIcon } from '@/components/map-icon'
import { Button } from '@/components/ui/button'
import { CursorTooltip } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/format'
import { useDragScroll } from '@/hooks/use-drag-scroll'
import { observeResize } from '@/lib/resizeObserve'
import { cn } from '@/lib/utils'
import { formatImpact, impactTone, type Played, RESULT_LABEL } from './facts'
import { ScoreBadge } from './score-badge'

/** Ratings this far from 1.00 take the full color, so an outlier never washes out the rest. */
const RATING_SPREAD = 0.5

const OPEN_DELAY_MS = 300
// The columns and the 1.00 line have to agree on it, with headroom for the tallest bar's rating.
const PLOT_BOX = 'h-32 pt-5 md:h-44'

/** One match column, and the half-width connector that stands between sessions. */
const ITEM_WIDTH = '3.5rem'
const ITEM_GAP = '0.25rem'
const CONNECTOR_WIDTH = '1.75rem'

const connectorTrack = { flex: 'none', width: CONNECTOR_WIDTH }

/** Shared by the columns row and the labels row, which must line up without sharing a parent. */
const sessionTrack = (size: number) => ({
  flex: 'none',
  width: `calc(${size} * ${ITEM_WIDTH} + ${size - 1} * ${ITEM_GAP})`,
})

/** What the columns report so the chart can decide when its popup opens. */
type PopupControl = {
  onColumn: (m: Played, e: ReactPointerEvent) => void
  onFocus: (m: Played, e: FocusEvent<HTMLElement>) => void
  onClose: () => void
}

const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

/** A darker left edge shades the session labels into the chart's background. */
const SESSION_LABEL_BG =
  'linear-gradient(to right, color-mix(in oklab, var(--color-background) 85%, black), var(--color-background))'

// The raw tokens: Tailwind only emits a `--color-*` variable it finds written out in full.
const RATING_MIDPOINT = 'color-mix(in oklab, var(--foreground) 70%, var(--muted))'

const barPercent = (rating: number, max: number) => Math.max((rating / max) * 100, 3)

const ratingColor = (rating: number) => {
  const pole = rating >= 1 ? 'var(--success)' : 'var(--danger)'
  const strength = Math.min(Math.abs(rating - 1) / RATING_SPREAD, 1) * 100

  return `color-mix(in oklab, ${pole} ${strength}%, ${RATING_MIDPOINT})`
}

const describe = ({ map, score, result, stats, playedAt }: Played) =>
  [
    `${mapName(map)}${score ? ` ${score.own}:${score.enemy}` : ''}`,
    result && RESULT_LABEL[result].toLowerCase(),
    stats.impact !== undefined && `impact ${formatImpact(stats.impact)}`,
    `rating ${stats.rating.toFixed(2)}`,
    `${stats.kills} kills, ${stats.deaths} deaths`,
    `${Math.round(stats.adr)} ADR`,
    formatDate(playedAt),
  ]
    .filter(Boolean)
    .join(', ')

const TipRow = ({
  label,
  children,
  className,
  color,
}: {
  label: string
  children: ReactNode
  className?: string
  color?: string
}) => (
  <tr>
    <th scope="row" className="py-0.5 text-left font-normal text-muted">
      {label}
    </th>
    <td className={cn('py-0.5 text-right font-medium', className)} style={{ color }}>
      {children}
    </td>
  </tr>
)

const MatchTip = ({ m }: { m: Played }) => {
  const { impact, rating, kills, deaths, adr } = m.stats

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <MapIcon map={m.map} className="size-5" />
        <span className="truncate text-body font-medium">{mapName(m.map)}</span>
        <ScoreBadge match={m} />
      </div>
      {/* Every row always renders, so the popup keeps its height from match to match. */}
      <table className="w-full tabular-nums">
        <tbody>
          <TipRow label="Impact" className={impact === undefined ? undefined : impactTone(impact)}>
            {impact === undefined ? '–' : formatImpact(impact)}
          </TipRow>
          <TipRow label="Rating" color={ratingColor(rating)}>
            {rating.toFixed(2)}
          </TipRow>
          <TipRow label="K / D">
            {kills}
            <span className="mx-1 font-normal text-muted">/</span>
            {deaths}
          </TipRow>
          <TipRow label="ADR">{Math.round(adr)}</TipRow>
        </tbody>
      </table>
      <span className="text-caption text-muted">{formatDate(m.playedAt)}</span>
    </div>
  )
}

const MatchColumn = ({ m, max, hovered }: { m: Played; max: number; hovered: boolean }) => {
  const height = barPercent(m.stats.rating, max)
  const color = ratingColor(m.stats.rating)

  return (
    <Link
      to="/matches/$id"
      params={{ id: m.matchId }}
      aria-label={describe(m)}
      className="relative flex w-full flex-col items-center rounded-md outline-none after:absolute after:inset-y-0 after:-inset-x-0.5 group-first:after:-left-1.5 group-last:after:-right-1.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn('block w-full', PLOT_BOX)}>
        <span className="relative block h-full">
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 rounded-[3px] transition-opacity duration-150 group-focus-within:opacity-100',
              hovered ? 'opacity-100' : 'opacity-75',
            )}
            style={{ height: `${height}%`, backgroundColor: color }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 z-20 mb-1 flex justify-center text-micro font-medium tabular-nums"
            style={{ bottom: `${height}%`, color }}
          >
            <span className="rounded-sm bg-surface px-1">{m.stats.rating.toFixed(2)}</span>
          </span>
        </span>
      </span>
      <MapIcon map={m.map} className="mt-2 size-4 rounded-sm text-micro" />
      <ScoreBadge match={m} className="mt-1.5 text-micro" />
    </Link>
  )
}

/** Opens on the newest matches and stays there through late layout, until the user scrolls. */
const pinToEnd = (viewport: HTMLDivElement | null) => {
  if (!viewport) return
  const stop = observeResize([viewport, ...viewport.children], () => {
    viewport.scrollLeft = viewport.scrollWidth
  })

  for (const input of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
    viewport.addEventListener(input, stop, { once: true, passive: true })
  }

  return stop
}

/** The side that leads takes its color; level stays neutral. */
export const WinLoss = ({ wins, losses }: { wins: number; losses: number }) => (
  <>
    <span className={cn(wins > losses && 'text-success')}>{wins}W</span>
    {' / '}
    <span className={cn(losses > wins && 'text-danger')}>{losses}L</span>
  </>
)

const SessionColumns = ({
  matches,
  max,
  hoveredId,
  popup,
}: {
  matches: Played[]
  max: number
  hoveredId: string | undefined
  popup: PopupControl
}) => (
  <li style={sessionTrack(matches.length)}>
    <ol className="flex gap-1">
      {matches.toReversed().map((m) => (
        <li
          key={m.matchId}
          className="group flex shrink-0"
          style={{ width: ITEM_WIDTH }}
          data-match-id={m.matchId}
          onPointerEnter={(e) => popup.onColumn(m, e)}
          onFocus={(e) => popup.onFocus(m, e)}
          onBlur={popup.onClose}
        >
          <MatchColumn m={m} max={max} hovered={m.matchId === hoveredId} />
        </li>
      ))}
    </ol>
  </li>
)

const connectorY = (rating: number, max: number) =>
  Math.min(92, Math.max(4, 100 - barPercent(rating, max)))

const connectorOutline = (
  start: number,
  end: number,
  rx: number,
  ry: number,
  offset: number,
) => {
  const topSegments = () => {
    if (start > end) {
      const xTarget = 100 - rx - offset
      const slope = (end - start) / xTarget
      const topStartX = rx
      const topStartY = start + rx * slope
      const lineEndX = xTarget - offset
      const lineEndY = end - offset * slope

      return [
        `M0 ${start + ry}`,
        `Q0 ${start} ${topStartX} ${topStartY}`,
        `L${lineEndX} ${lineEndY}`,
        `Q${xTarget} ${end} ${100 - rx} ${end}`,
        `Q100 ${end} 100 ${end + ry}`,
      ]
    }

    if (start < end) {
      const xTarget = rx + offset
      const slope = (end - start) / (100 - xTarget)
      const lineStartX = xTarget + offset
      const lineStartY = start + offset * slope
      const topEndX = 100 - rx
      const topEndY = end - rx * slope

      return [
        `M0 ${start + ry}`,
        `Q0 ${start} ${rx} ${start}`,
        `Q${xTarget} ${start} ${lineStartX} ${lineStartY}`,
        `L${topEndX} ${topEndY}`,
        `Q100 ${end} 100 ${end + ry}`,
      ]
    }

    return [
      `M0 ${start + ry}`,
      `Q0 ${start} ${rx} ${start}`,
      `L${100 - rx} ${end}`,
      `Q100 ${end} 100 ${end + ry}`,
    ]
  }

  return [
    ...topSegments(),
    `L100 ${100 - ry}`,
    `Q100 100 ${100 - rx} 100`,
    `L${rx} 100`,
    `Q0 100 0 ${100 - ry}`,
    'Z',
  ].join(' ')
}

/** Half a column wide, joining the ratings either side of a break between sessions. */
const SessionConnector = ({
  from,
  to,
  max,
  popup,
}: {
  from: Played
  to: Played
  max: number
  popup: PopupControl
}) => {
  const start = connectorY(from.stats.rating, max)
  const end = connectorY(to.stats.rating, max)
  const outline = connectorOutline(start, end, 14, 3, 4)

  return (
    <li aria-hidden style={connectorTrack} className={cn('relative z-10', PLOT_BOX)}>
      <div className="relative h-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full overflow-visible text-border-strong"
        >
          <path
            d={outline}
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {/* Each half hands its hover to the match it faces, lighting up that column. */}
      {/* -inset-x-3 spans the gap-3 between sessions, and -top-10 covers the full chart height. */}
      <div className="absolute -inset-x-3 -top-10 bottom-0 z-10 flex">
        {[from, to].map((m) => (
          <div
            key={m.matchId}
            className="h-full w-1/2"
            data-match-id={m.matchId}
            onPointerEnter={(e) => popup.onColumn(m, e)}
          />
        ))}
      </div>
    </li>
  )
}

const SessionLabel = ({ matches }: { matches: Played[] }) => {
  const { wins, losses } = summarize(matches)
  const date = DAY.format(new Date(matches.at(-1)!.playedAt))
  // A shorter session's label fills its block, leaving nothing to travel.
  const sticks = matches.length > 2

  return (
    <li style={sessionTrack(matches.length)}>
      {/* Overlaid, each inset by the other's width plus 16px: sticky stops at its parent's
          padding, so the labels push each other instead of colliding. */}
      <Button
        size="xs"
        variant="recessed"
        className={cn(
          // The pseudo-element takes the hit area to 32px, past the 28px it draws.
          '-mx-1 w-[calc(100%+0.5rem)] text-left text-micro font-normal after:absolute after:-inset-y-0.5 after:inset-x-0',
          matches.length > 1 ? 'px-2.5' : 'px-1.5',
        )}
        // The layer stays clear at rest so the gradient shows; hover still fills it.
        style={{ backgroundImage: SESSION_LABEL_BG, '--bg': 'transparent' } as CSSProperties}
      >
        <span className="grid w-full *:col-start-1 *:row-start-1">
          <span className={cn(sticks && 'pr-16', matches.length === 1 && 'text-center')}>
            <span className={cn('inline-block', sticks && 'sticky left-5.5')}>{date}</span>
          </span>
          {matches.length > 1 && (
            <span className={cn('text-right tabular-nums', sticks && 'pl-14')}>
              <span className={cn('inline-block', sticks && 'sticky right-5.5')}>
                <WinLoss wins={wins} losses={losses} />
              </span>
            </span>
          )}
        </span>
      </Button>
    </li>
  )
}

/**
 * One column per match, oldest to newest and grouped by session: a bar rising from 0 with its
 * rating on top and a dashed line at 1.00, the map and score under it. Scrolls sideways rather than
 * squeezing, opening on the newest.
 */
export const SessionSplitChart = ({ sessions }: { sessions: Played[][] }) => {
  const [active, setActive] = useState<Played | null>(null)
  const [hovered, setHovered] = useState<Played | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const [armed, setArmed] = useState(false)
  const [figure, setFigure] = useState<HTMLElement | null>(null)
  const [columns, setColumns] = useState<HTMLElement | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const max = Math.max(2, ...sessions.flat().map((m) => m.stats.rating))
  const chronological = sessions.toReversed()
  // The figure sets the sides, since the columns run on past it while scrolled; the columns set
  // the top and bottom.
  const boundary = [figure, columns].filter((el) => el !== null)

  const scheduleOpen = () => {
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(() => setArmed(true), OPEN_DELAY_MS)
  }

  const openAfterDelay = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') scheduleOpen()
  }

  const close = () => {
    clearTimeout(openTimer.current)
    setArmed(false)
  }

  const popup: PopupControl = {
    onColumn: (m, e) => {
      if (e.pointerType === 'touch') return
      pointer.current = { x: e.clientX, y: e.clientY }
      hoverMatch(m)
      if (!armed && !openTimer.current) {
        scheduleOpen()
      }
    },
    onFocus: (m, e) => {
      // A tap or click focuses the link too, and only the keyboard should open the popup.
      if (!e.target.matches(':focus-visible')) return
      setActive(m)
      setArmed(true)
    },
    onClose: close,
  }

  const matchAt = ({ x, y }: { x: number; y: number }) => {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-match-id]')

    return sessions.flat().find((m) => m.matchId === column?.dataset.matchId)
  }

  const hoverMatch = (m: Played) => {
    setActive(m)
    setHovered(m)
  }

  const leaveColumns = () => {
    pointer.current = null
    setHovered(null)
    close()
  }

  // Pointer capture hides the columns' leave and enter events, so a drag settles hover itself.
  const { dragging, handlers } = useDragScroll({
    onDragStart: leaveColumns,
    onDragEnd: (point) => {
      const match = point && matchAt(point)

      if (!point || !match) return
      pointer.current = point
      hoverMatch(match)
      scheduleOpen()
    },
  })

  const syncHoverToScroll = () => {
    if (!pointer.current || !columns) return
    const rect = columns.getBoundingClientRect()
    const { x, y } = pointer.current

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      leaveColumns()

      return
    }

    const match = matchAt(pointer.current)

    if (match) {
      hoverMatch(match)
      if (!armed && !openTimer.current) {
        scheduleOpen()
      }
    }
  }

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- Scrolling the page or chart moves content under a still cursor without pointer events, and only a window listener sees both.
  useEffect(() => {
    if (!hovered) return
    const options = { capture: true, passive: true }

    window.addEventListener('scroll', syncHoverToScroll, options)

    return () => window.removeEventListener('scroll', syncHoverToScroll, options)
  })

  // The scroller bleeds 1rem into the page gutter, so columns scroll out past the content edge
  // instead of being cut at it, with a Base UI scrollbar in the padding below.
  return (
    <figure ref={setFigure}>
      <ScrollArea.Root
        className={cn(
          'relative -mx-4 overflow-x-clip pb-2 data-has-overflow-x:cursor-grab',
          // An eased fade (ease-out alpha stops), so the edge has no visible band.
          '[--fade:var(--color-surface),color-mix(in_oklab,var(--color-surface)_74%,transparent)_19%,color-mix(in_oklab,var(--color-surface)_54%,transparent)_34%,color-mix(in_oklab,var(--color-surface)_38%,transparent)_47%,color-mix(in_oklab,var(--color-surface)_19%,transparent)_65%,color-mix(in_oklab,var(--color-surface)_8%,transparent)_80%,color-mix(in_oklab,var(--color-surface)_2%,transparent)_91%,transparent]',
        )}
      >
        <ScrollArea.Viewport
          ref={pinToEnd}
          className={cn(
            'overscroll-x-contain overscroll-y-none select-none',
            'active:cursor-grabbing',
            dragging && 'cursor-grabbing',
          )}
          {...handlers}
        >
          <ScrollArea.Content className="px-4 pt-1 pb-1 [&_*]:cursor-grab">
            <div className="w-max min-w-full">
              {/* Isolated so the line and ratings layer among themselves, under the edge fades. */}
              <div
                ref={setColumns}
                className={cn(
                  'relative isolate',
                  // Pressing or dragging reads as grabbing; at rest everything shows grab, not a hand.
                  'active:[&_*]:cursor-grabbing!',
                  dragging && '[&_*]:cursor-grabbing!',
                )}
              >
                <CursorTooltip
                  content={active && <MatchTip m={active} />}
                  armed={armed && !!active}
                  boundary={boundary}
                  className="w-56 p-3 max-md:hidden"
                  trigger={
                    <ol
                      aria-label="Rating by match, grouped by session, oldest first"
                      className="flex gap-3"
                      onPointerEnter={(e) => {
                        pointer.current = { x: e.clientX, y: e.clientY }
                        openAfterDelay(e)
                      }}
                      onPointerMove={(e) => {
                        pointer.current = { x: e.clientX, y: e.clientY }
                      }}
                      onPointerLeave={leaveColumns}
                    >
                      {chronological.map((session, i) => {
                        const next = chronological[i + 1]

                        return (
                          <Fragment key={session[0]!.matchId}>
                            <SessionColumns
                              matches={session}
                              max={max}
                              hoveredId={hovered?.matchId}
                              popup={popup}
                            />
                            {next && (
                              <SessionConnector
                                from={session[0]!}
                                to={next.at(-1)!}
                                max={max}
                                popup={popup}
                              />
                            )}
                          </Fragment>
                        )
                      })}
                    </ol>
                  }
                />
                {/* Between the bars and their ratings: each rating masks the line. */}
                <div
                  aria-hidden
                  className={cn('pointer-events-none absolute -inset-x-4 top-0 z-1', PLOT_BOX)}
                >
                  <div className="relative h-full">
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-foreground/30"
                      style={{ bottom: `${(1 / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <ol aria-label="Sessions" className="mt-2 flex gap-3">
                {chronological.map((session, i) => (
                  <Fragment key={session[0]!.matchId}>
                    <SessionLabel matches={session} />
                    {i < chronological.length - 1 && <li aria-hidden style={connectorTrack} />}
                  </Fragment>
                ))}
              </ol>
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        {/* Columns fade into the gutter the scroller bleeds into, rather than cut at the screen. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-4 bg-[linear-gradient(to_right,var(--fade))] md:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-4 bg-[linear-gradient(to_left,var(--fade))] md:block"
        />
        <ScrollArea.Scrollbar
          orientation="horizontal"
          className={cn(
            'absolute bottom-0 mx-4 flex h-1.5 cursor-default items-center rounded-full bg-foreground/[0.04]',
            'opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100',
            'motion-reduce:transition-none',
          )}
        >
          <ScrollArea.Thumb className="h-full rounded-full bg-foreground/20 transition-colors hover:bg-foreground/30 active:bg-foreground/40" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </figure>
  )
}
