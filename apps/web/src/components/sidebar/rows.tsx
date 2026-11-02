import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { MapIcon, matchName } from '@/components/map-icon'
import { MatchMenu } from '@/components/match-menu'
import { isProcessing } from '@/components/match-status'
import { perspectiveScore } from '@/components/match-table'
import { NewDot } from '@/components/new-dot'
import { ProgressRing, liveProgress } from '@/components/queue-ring'
import { Tooltip } from '@/components/ui/tooltip'
import { percent, useMatchProgress, useProgressMap } from '@/hooks/use-match-events'
import { shortAge } from '@/lib/format'
import { justFound } from '@/lib/new-matches'
import { type MatchListItem, type QueueItem, queueQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const rowClass = (collapsed: boolean) =>
  cn(
    'flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-2.75 text-body whitespace-nowrap text-muted outline-none select-none',
    // The rail's width, and the text/icon color as a row becomes active; backgrounds switch
    // instantly.
    '[transition:width_200ms_var(--ease-out-quart),color_150ms_ease-out]',
    // Hover only tints the row; the text stays muted until the row is the active one.
    'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring',
    'data-[status=active]:bg-surface-2 data-[status=active]:text-foreground',
    '[&_svg]:size-4.5 [&_svg]:shrink-0',
    collapsed ? 'w-10' : 'w-full',
  )

/** The path being navigated to while its route loads, so its row can shimmer. */
export const usePendingPath = () =>
  useRouterState({
    select: (s) => (s.status === 'pending' ? s.location.pathname : undefined),
  })

/** Text that fades out in the rail instead of being removed (removal would shift the layout). */
export const fade = (collapsed: boolean) =>
  cn('transition-opacity duration-150', collapsed && 'pointer-events-none opacity-0')

export const NavItem = ({
  to,
  icon,
  label,
  collapsed,
  onNavigate,
  viewTransition,
}: {
  to: '/' | '/matches'
  icon: ReactNode
  label: string
  collapsed: boolean
  onNavigate?: () => void
  viewTransition?: boolean
}) => {
  const pending = usePendingPath() === to

  return (
    <Link
      to={to}
      // Filters live in the query string; the section is active whatever they are.
      activeOptions={{ exact: true, includeSearch: false }}
      onClick={onNavigate}
      viewTransition={viewTransition}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(rowClass(collapsed), pending && 'shimmer')}
    >
      {icon}
      <span className={fade(collapsed)}>{label}</span>
    </Link>
  )
}

/**
 * A row's trailing slot and its menu share one spot. With a mouse the score sits there and the
 * menu button swaps in on hover (or focus, or while its menu is open); on touch screens there is
 * no hover, so the button stays and the score moves left of it.
 */
const swapOut =
  'pointer-fine:group-hover/row:opacity-0 pointer-fine:group-has-[:focus-visible]/row:opacity-0 pointer-fine:group-has-data-popup-open/row:opacity-0'

const swapIn =
  'pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-has-[:focus-visible]/row:opacity-100 pointer-fine:data-popup-open:opacity-100'

/**
 * Hovered dozens of times a day: the swap itself is instant (opacity never transitions), but the
 * menu button's icon still eases its color like every other button.
 */
const swapTransition = 'transition-[color] duration-150 ease-out'

export const RecentRow = ({
  match,
  collapsed,
  pending,
  onNavigate,
  viewTransition,
}: {
  match: MatchListItem
  collapsed: boolean
  pending: boolean
  onNavigate?: () => void
  viewTransition?: boolean
}) => {
  const score = perspectiveScore(match, match.player?.startingSide)
  const streamed = useMatchProgress(match.id, match.status)
  // The queue's poll covers what the stream hasn't said yet (e.g. right after a reload).
  const { data: queued } = useQuery({
    ...queueQuery,
    select: (data) => data.items.find((item) => item.matchId === match.id),
  })
  const polled = useQueuedProgress(queued)
  const progress = streamed ?? polled
  // Only a row that just turned up grows in; one that was already there stays put.
  const [entering] = useState(() => justFound(match.id))

  return (
    <div
      className={cn(
        'group/row relative',
        entering &&
          'h-10 overflow-hidden transition-[height,opacity] duration-300 ease-out-quart starting:h-0 starting:opacity-0',
      )}
    >
      <Link
        to="/matches/$id"
        params={{ id: match.id }}
        onClick={onNavigate}
        viewTransition={viewTransition}
        title={collapsed ? matchName(match.map, match.status) : undefined}
        className={cn(
          rowClass(collapsed),
          'h-10 px-2',
          !collapsed && 'pointer-coarse:pr-10',
          // Lit while the pointer is anywhere on the row, its menu button included (the button
          // sits over the link, so the link's own hover ends there), and while its menu is open.
          'group-hover/row:bg-surface-2 group-has-data-popup-open/row:bg-surface-2',
          pending && 'shimmer',
        )}
      >
        {/* In the rail the name (and its new-match dot) fades out, so a dot fades in on the map. */}
        <span className="relative flex shrink-0">
          <MapIcon map={match.map} className="size-6 rounded-md text-label" />
          <NewDot
            matchId={match.id}
            hidden={!collapsed}
            className="absolute -top-0.5 -right-0.5 ml-0"
          />
        </span>
        <span className={cn('flex min-w-0 flex-1 items-center gap-2', fade(collapsed))}>
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="flex min-w-0 items-center">
              <span className="truncate text-foreground/90">
                {matchName(match.map, match.status)}
              </span>
              <NewDot matchId={match.id} />
            </span>
            <span className="shrink-0 text-caption text-muted/60 tabular-nums">
              {shortAge(match.playedAt ?? match.discoveredAt)}
            </span>
          </span>
          <span className={cn('flex items-center', swapTransition, swapOut)}>
            {/* Only a stage that reports how far it is gets a ring; a spinner would say nothing. */}
            {isProcessing(match.status) && progress !== undefined && (
              <Tooltip
                content={percent(progress)}
                trigger={
                  <span className="mr-2 flex text-foreground/50">
                    <ProgressRing progress={progress} size={14} />
                  </span>
                }
              />
            )}
            {match.cancelled ? (
              <span className="text-caption text-muted">Cancelled</span>
            ) : match.status === 'failed' || match.status === 'expired' ? (
              <span className="text-caption text-danger">
                {match.status === 'failed' ? 'Failed' : 'Expired'}
              </span>
            ) : score ? (
              // Known once the demo is analyzed, so it shows beside the spinner while clips record.
              <span className="font-mono text-label tabular-nums">
                <span
                  className={
                    score.result === 'win'
                      ? 'text-success'
                      : score.result === 'loss'
                        ? 'text-danger'
                        : undefined
                  }
                >
                  {score.own}
                </span>
                :{score.enemy}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
      {!collapsed && (
        <MatchMenu
          match={match}
          onNavigate={onNavigate}
          align="start"
          side="right"
          triggerClassName={cn(
            'absolute top-1/2 right-1.5 -translate-y-1/2',
            swapTransition,
            swapIn,
          )}
        />
      )}
    </div>
  )
}

/** A queue item's progress, when the match is in the queue. */
const useQueuedProgress = (item: QueueItem | undefined) => {
  const streamed = useProgressMap()

  return item ? liveProgress(item, streamed).progress : undefined
}
