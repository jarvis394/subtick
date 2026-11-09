import { ScrollArea } from '@base-ui/react/scroll-area'
import { mapName, summarize } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import {
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

/** Shared by the columns row and the labels row, which must line up without sharing a parent. */
const sessionTrack = (size: number) => ({
  flex: `${size} ${size} 0`,
  minWidth: `calc(${size} * 3.25rem + ${size - 1} * 0.25rem)`,
})

/** What the columns report so the chart can decide when its popup opens. */
type PopupControl = {
  onColumn: (m: Played, e: ReactPointerEvent) => void
  onFocus: (m: Played, e: FocusEvent<HTMLElement>) => void
  onClose: () => void
}

const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

const RATING_MIDPOINT = 'color-mix(in oklab, var(--color-foreground) 70%, var(--color-muted))'

const barPercent = (rating: number, max: number) => Math.max((rating / max) * 100, 3)

const ratingColor = (rating: number) => {
  const pole = rating >= 1 ? 'success' : 'danger'
  const strength = Math.min(Math.abs(rating - 1) / RATING_SPREAD, 1) * 100

  return `color-mix(in oklab, var(--color-${pole}) ${strength}%, ${RATING_MIDPOINT})`
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
            className="absolute inset-x-0 mb-1 text-center text-micro font-medium tabular-nums"
            style={{ bottom: `${height}%`, color }}
          >
            {m.stats.rating.toFixed(2)}
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
          className="group flex min-w-13 flex-1"
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
      hoverMatch(m)
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
    if (!pointer.current) return
    const match = matchAt(pointer.current)

    if (match) hoverMatch(match)
    else leaveColumns()
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
          className={cn('overscroll-x-contain select-none', dragging && 'cursor-grabbing')}
          {...handlers}
        >
          <ScrollArea.Content className="px-4 pt-1 pb-1">
            <div className="w-max min-w-full">
              <div ref={setColumns}>
                <CursorTooltip
                  content={active && <MatchTip m={active} />}
                  armed={armed && !!active}
                  boundary={boundary}
                  className="w-56 p-3 max-md:hidden"
                  trigger={
                    <ol
                      aria-label="Rating by match, grouped by session, oldest first"
                      className="flex gap-3"
                      onPointerEnter={openAfterDelay}
                      onPointerMove={(e) => {
                        pointer.current = { x: e.clientX, y: e.clientY }
                      }}
                      onPointerLeave={leaveColumns}
                    >
                      {chronological.map((session) => (
                        <SessionColumns
                          key={session[0]!.matchId}
                          matches={session}
                          max={max}
                          hoveredId={hovered?.matchId}
                          popup={popup}
                        />
                      ))}
                    </ol>
                  }
                />
              </div>
              <ol aria-label="Sessions" className="mt-2 flex gap-3">
                {chronological.map((session) => (
                  <SessionLabel key={session[0]!.matchId} matches={session} />
                ))}
              </ol>
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        {/* Over the viewport, not inside it, so the line and its label stay put while columns scroll. */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-1', PLOT_BOX)}>
          <div className="relative h-full">
            <div
              className="absolute inset-x-0 border-t border-dashed border-foreground/30"
              style={{ bottom: `${(1 / max) * 100}%` }}
            >
              <span className="absolute right-4 bottom-1 rounded-sm bg-surface px-1 text-micro text-muted tabular-nums">
                1.00
              </span>
            </div>
          </div>
        </div>
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
