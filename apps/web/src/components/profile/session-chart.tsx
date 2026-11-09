import { ScrollArea } from '@base-ui/react/scroll-area'
import { AnimatePresence, motion } from 'motion/react'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { CursorTooltip } from '@/components/ui/tooltip'
import { useDragScroll } from '@/hooks/use-drag-scroll'
import { cn } from '@/lib/utils'
import type { Played } from './facts'
import { MatchColumn, MatchTip, PLOT_BOX, type PopupControl } from './match-column'
import { SessionConnector } from './session-connector'
import { connectorId } from './session-layout'
import { SessionLabel, sessionKey, Track } from './session-track'
import { useSessionZoom } from './use-session-zoom'

const OPEN_DELAY_MS = 300

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
  <ol className="flex gap-1">
    {matches.toReversed().map((m) => (
      <li
        key={m.matchId}
        className="group flex min-w-0 flex-1"
        data-match-id={m.matchId}
        onPointerEnter={(e) => popup.onColumn(m, e)}
        onFocus={(e) => popup.onFocus(m, e)}
        onBlur={popup.onClose}
      >
        <MatchColumn m={m} max={max} hovered={m.matchId === hoveredId} />
      </li>
    ))}
  </ol>
)

/**
 * One column per match, oldest to newest and grouped by session: a bar rising from 0 with its
 * rating on top and a dashed line at 1.00, the map and score under it. Scrolls sideways rather than
 * squeezing, opening on the newest. A `focusKey` zooms the chart into that session.
 */
export const SessionSplitChart = ({
  sessions,
  focusKey,
  onToggleSession,
}: {
  sessions: Played[][]
  focusKey: string | null
  onToggleSession?: (key: string) => void
}) => {
  const [active, setActive] = useState<Played | null>(null)
  const [hovered, setHovered] = useState<Played | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const [armed, setArmed] = useState(false)
  const [columns, setColumns] = useState<HTMLElement | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const max = Math.max(2, ...sessions.flat().map((m) => m.stats.rating))
  const chronological = sessions.toReversed()

  const shownSessions = focusKey
    ? chronological.filter((s) => sessionKey(s) === focusKey)
    : chronological

  const { setViewport, layout, transition, departure } = useSessionZoom({
    sessions: chronological.map((s) => ({ key: sessionKey(s), size: s.length })),
    focusKey,
  })

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
    <figure>
      <ScrollArea.Root
        className={cn(
          'relative -mx-4 overflow-x-clip pb-2 data-has-overflow-x:cursor-grab',
          // An eased fade (ease-out alpha stops), so the edge has no visible band.
          '[--fade:var(--color-surface),color-mix(in_oklab,var(--color-surface)_74%,transparent)_19%,color-mix(in_oklab,var(--color-surface)_54%,transparent)_34%,color-mix(in_oklab,var(--color-surface)_38%,transparent)_47%,color-mix(in_oklab,var(--color-surface)_19%,transparent)_65%,color-mix(in_oklab,var(--color-surface)_8%,transparent)_80%,color-mix(in_oklab,var(--color-surface)_2%,transparent)_91%,transparent]',
        )}
      >
        <ScrollArea.Viewport
          ref={setViewport}
          className={cn(
            'overscroll-x-contain overscroll-y-none select-none',
            'active:cursor-grabbing',
            dragging && 'cursor-grabbing',
          )}
          {...handlers}
        >
          {/* Clipped so sessions pushed past the right edge never widen the scrollable area. */}
          <ScrollArea.Content className="overflow-x-clip px-4 pt-1 pb-1 [&_*]:cursor-grab">
            <motion.div
              className="min-w-full"
              initial={false}
              animate={{ width: layout.total, transition }}
            >
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
                  className="w-56 p-3 max-md:hidden"
                  trigger={
                    <ol
                      aria-label="Rating by match, grouped by session, oldest first"
                      className="grid grid-cols-1 *:col-start-1 *:row-start-1"
                      onPointerEnter={(e) => {
                        pointer.current = { x: e.clientX, y: e.clientY }
                        openAfterDelay(e)
                      }}
                      onPointerMove={(e) => {
                        pointer.current = { x: e.clientX, y: e.clientY }
                      }}
                      onPointerLeave={leaveColumns}
                    >
                      <AnimatePresence initial={false} custom={departure}>
                        {shownSessions.flatMap((session, i) => {
                          const key = sessionKey(session)
                          const next = shownSessions[i + 1]
                          const slot = layout.slots[key]

                          if (!slot) return []

                          const connector = connectorId(key)
                          const connectorSlot = layout.slots[connector]

                          return [
                            <Track
                              key={key}
                              id={key}
                              slot={slot}
                              transition={transition}
                              departure={departure}
                            >
                              <SessionColumns
                                matches={session}
                                max={max}
                                hoveredId={hovered?.matchId}
                                popup={popup}
                              />
                            </Track>,
                            ...(next && connectorSlot
                              ? [
                                  <Track
                                    key={connector}
                                    id={connector}
                                    slot={connectorSlot}
                                    transition={transition}
                                    departure={departure}
                                    decorative
                                    className={PLOT_BOX}
                                  >
                                    <SessionConnector
                                      from={session[0]!}
                                      to={next.at(-1)!}
                                      max={max}
                                      popup={popup}
                                    />
                                  </Track>,
                                ]
                              : []),
                          ]
                        })}
                      </AnimatePresence>
                    </ol>
                  }
                />
                {/* Between the bars and their ratings: each rating masks the line. */}
                <div
                  aria-hidden
                  className={cn('pointer-events-none absolute -inset-x-4 top-0 z-10', PLOT_BOX)}
                >
                  <div className="relative h-full">
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-foreground/30"
                      style={{ bottom: `${(1 / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <ol
                aria-label="Sessions"
                className="mt-2 grid grid-cols-1 *:col-start-1 *:row-start-1"
              >
                <AnimatePresence initial={false} custom={departure}>
                  {shownSessions.map((session) => {
                    const key = sessionKey(session)
                    const slot = layout.slots[key]

                    return (
                      slot && (
                        <Track
                          key={key}
                          id={key}
                          slot={slot}
                          transition={transition}
                          departure={departure}
                        >
                          <SessionLabel
                            matches={session}
                            open={key === focusKey}
                            onToggle={onToggleSession && (() => onToggleSession(key))}
                          />
                        </Track>
                      )
                    )
                  })}
                </AnimatePresence>
              </ol>
            </motion.div>
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
