import { Menu } from '@base-ui/react/menu'
import { mapName } from '@subtick/domain'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  Clapperboard,
  LogOut,
  PanelLeft,
  Settings,
  Server,
  Swords,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { FadeSwap } from '@/components/fade-swap'
import { MapIcon } from '@/components/map-icon'
import { MatchMenu } from '@/components/match-menu'
import { ProgressRing, QueueRing, liveProgress, useQueueSummary } from '@/components/queue-ring'
import { perspectiveScore } from '@/components/match-table'
import { isProcessing } from '@/components/match-status'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { NewDot } from '@/components/new-dot'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Skeleton } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import { Wordmark } from '@/components/wordmark'
import { useDelayed } from '@/hooks/use-delayed'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { justFound } from '@/lib/new-matches'
import { useRefreshNotice } from '@/hooks/use-refresh-notice'
import { percent, useMatchProgress, useProgressMap } from '@/hooks/use-match-events'
import { authClient } from '@/lib/auth'
import { shortAge } from '@/lib/format'
import {
  type MatchListItem,
  type QueueItem,
  meQuery,
  queueQuery,
  recentMatchesQuery,
} from '@/lib/queries'
import { isSetUp } from '@/lib/setup'
import { clearStoredMe } from '@/lib/stored-me'
import { cn } from '@/lib/utils'

/**
 * Geometry is identical expanded and collapsed: the sidebar keeps its full-width layout and the
 * rail (56px) just clips it. Every icon is centered on x = 28px, so nothing moves while the width
 * animates; labels only fade. Rows shrink to 40px squares so hover states stay tidy in the rail.
 */
export const RAIL_WIDTH = 'w-14'

const rowClass = (collapsed: boolean) =>
  cn(
    'flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-[11px] text-sm whitespace-nowrap text-muted outline-none select-none',
    // The rail's width, and the text/icon color as a row becomes active; backgrounds switch
    // instantly.
    '[transition:width_200ms_var(--ease-out-quart),color_150ms_ease-out]',
    // Hover only tints the row; the text stays muted until the row is the active one.
    'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring',
    'data-[status=active]:bg-surface-2 data-[status=active]:text-foreground',
    '[&_svg]:size-[18px] [&_svg]:shrink-0',
    collapsed ? 'w-10' : 'w-full',
  )

/** The path being navigated to while its route loads, so its row can shimmer. */
const usePendingPath = () =>
  useRouterState({
    select: (s) => (s.status === 'pending' ? s.location.pathname : undefined),
  })

/** Text that fades out in the rail instead of being removed (removal would shift the layout). */
const fade = (collapsed: boolean) =>
  cn('transition-opacity duration-150', collapsed && 'pointer-events-none opacity-0')

const NavItem = ({
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

const RecentRow = ({
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
        title={collapsed ? mapName(match.map) : undefined}
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
        <MapIcon map={match.map} className="size-6 rounded-md text-[12px]" />
        <span className={cn('flex min-w-0 flex-1 items-center gap-2', fade(collapsed))}>
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="flex min-w-0 items-center">
              <span className="truncate text-foreground/90">{mapName(match.map)}</span>
              <NewDot matchId={match.id} />
            </span>
            <span className="shrink-0 text-[11px] text-muted/60 tabular-nums">
              {shortAge(match.playedAt ?? match.discoveredAt)}
            </span>
          </span>
          <span className={cn('flex items-center', swapTransition, swapOut)}>
            {isProcessing(match.status) && (
              <span
                className="mr-2 flex text-foreground/50"
                title={progress !== undefined ? percent(progress) : 'Processing'}
              >
                <ProgressRing progress={progress} size={14} />
              </span>
            )}
            {match.cancelled ? (
              <span className="text-[11px] text-muted">Cancelled</span>
            ) : match.status === 'failed' || match.status === 'expired' ? (
              <span className="text-[11px] text-danger">
                {match.status === 'failed' ? 'Failed' : 'Expired'}
              </span>
            ) : score ? (
              // Known once the demo is analyzed, so it shows beside the spinner while clips record.
              <span className="font-mono text-[12px] tabular-nums">
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

/** Opens the Queue page; the badge counts matches with pipeline work across the instance. */
const QueueButton = ({
  onNavigate,
  viewTransition,
  className,
}: {
  onNavigate?: () => void
  viewTransition?: boolean
  className?: string
}) => {
  const { data } = useQuery(queueQuery)
  const items = data?.items ?? []
  const pending = usePendingPath() === '/queue'
  const label = items.length ? `Queue, ${items.length} in progress` : 'Queue'
  const summary = useQueueSummary(items)

  return (
    <Tooltip
      side="top"
      content={
        summary.running.length || summary.waiting ? (
          <div className="grid gap-1.5">
            {summary.running.map((task) => (
              <div key={task.id} className="min-w-0">
                <p className="font-medium">{task.map}</p>
                <p className="text-muted tabular-nums">{task.task}</p>
              </div>
            ))}
            {summary.waiting > 0 && (
              <p className="text-muted">
                {summary.waiting} {summary.running.length ? 'more ' : ''}waiting
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted">Queue is empty</span>
        )
      }
      trigger={
        // The tooltip is the queue's summary, so the button's own label tooltip is off.
        <IconButton
          size="lg"
          label={label}
          tooltip={false}
          render={<Link to="/queue" onClick={onNavigate} viewTransition={viewTransition} />}
          className={cn(pending && 'shimmer', className)}
        >
          <QueueRing items={items} />
        </IconButton>
      }
    />
  )
}

/** A queue item's progress, when the match is in the queue. */
const useQueuedProgress = (item: QueueItem | undefined) => {
  const streamed = useProgressMap()
  return item ? liveProgress(item, streamed).progress : undefined
}

const SKELETON_WIDTHS = ['w-14', 'w-16', 'w-12', 'w-16', 'w-14']

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted'

export const SidebarContent = ({
  collapsed,
  onToggle,
  toggleLabel,
  onNavigate,
  viewTransition,
}: {
  collapsed: boolean
  onToggle?: () => void
  /** Overrides the toggle's expand/collapse label (the mobile drawer uses it to close). */
  toggleLabel?: string
  onNavigate?: () => void
  /**
   * Off for the mobile drawer: there the drawer closing over the new page is the transition, and a
   * page transition on top would draw the drawer's snapshot over the page sliding back in.
   */
  viewTransition?: boolean
}) => {
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: recent, isError: recentFailed, refetch, isFetching } = useQuery(recentMatchesQuery)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pendingPath = usePendingPath()
  // Nothing until a load has run a while: most finish sooner and never show the skeleton.
  const showSkeleton = useDelayed(!recent && !recentFailed, 400)
  const setUp = isSetUp(me)
  const refresh = useRefreshMatches()
  const notice = useRefreshNotice(refresh)

  const signOut = async () => {
    await authClient.signOut()
    clearStoredMe()
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  const avatar = me.steamLinks[0]?.avatarUrl ?? me.user.image
  const subtitle = me.user.email.endsWith('@steam.invalid') ? 'Steam account' : me.user.email

  return (
    <div className="flex h-full w-full min-w-64 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-1.5 px-3">
        {onToggle && (
          <IconButton
            size="sm"
            label={toggleLabel ?? (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            onClick={onToggle}
          >
            <PanelLeft />
          </IconButton>
        )}
        <Link
          to="/"
          onClick={onNavigate}
          viewTransition={viewTransition}
          tabIndex={collapsed ? -1 : undefined}
          className={cn(
            'rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            fade(collapsed),
          )}
        >
          <Wordmark />
        </Link>
        {!setUp && (
          <Button
            size="xs"
            render={<Link to="/setup" onClick={onNavigate} viewTransition={viewTransition} />}
            tabIndex={collapsed ? -1 : undefined}
            className={cn('ml-auto', fade(collapsed))}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Finish setup
          </Button>
        )}
      </div>

      {/* Header and footer hold still; everything between them scrolls as one. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-2">
        <nav className="grid gap-0.5 px-2">
          <NavItem
            to="/"
            icon={<Clapperboard />}
            label="Highlights"
            collapsed={collapsed}
            onNavigate={onNavigate}
            viewTransition={viewTransition}
          />
          <NavItem
            to="/matches"
            icon={<Swords />}
            label="Matches"
            collapsed={collapsed}
            onNavigate={onNavigate}
            viewTransition={viewTransition}
          />
        </nav>

        <div className="mt-5 px-2">
          <div className={cn('flex h-7 items-center pr-1 pl-[11px]', fade(collapsed))}>
            <FadeSwap className="flex-1" swapKey={notice ? 'notice' : 'title'}>
              {notice ? (
                <p className="text-[12px] font-medium whitespace-nowrap text-link">{notice}</p>
              ) : (
                <p className="text-[12px] font-medium whitespace-nowrap text-muted/70">Recents</p>
              )}
            </FadeSwap>
            {setUp && (
              <IconButton
                size="xs"
                label="Check for new matches"
                onClick={refresh.mutate}
                disabled={refresh.isPending}
                tabIndex={collapsed ? -1 : undefined}
              >
                <RefreshIcon spinning={refresh.isPending} />
              </IconButton>
            )}
          </div>
          <FadeSwap
            swapKey={recent ? 'ready' : recentFailed ? 'failed' : showSkeleton ? 'loading' : 'idle'}
          >
            {recent ? (
              <>
                {recent.items.length === 0 && (
                  <div
                    className={cn(
                      'grid justify-items-center rounded-xl border border-dashed px-4 py-6 text-center',
                      fade(collapsed),
                    )}
                  >
                    <span className="mb-3 grid size-9 place-items-center rounded-lg border bg-surface text-muted">
                      <Swords className="size-4" />
                    </span>
                    <p className="text-[13px] font-medium">No matches yet</p>
                    <p className="mt-1 text-[12px] text-balance text-muted">
                      {setUp
                        ? 'Matches you play show up here.'
                        : 'Finish setup to start picking up your matches.'}
                    </p>
                  </div>
                )}
                <div className="grid gap-0.5">
                  {recent.items.map((match) => (
                    <RecentRow
                      key={match.id}
                      match={match}
                      collapsed={collapsed}
                      pending={pendingPath === `/matches/${match.id}`}
                      onNavigate={onNavigate}
                      viewTransition={viewTransition}
                    />
                  ))}
                </div>
              </>
            ) : recentFailed ? (
              // Without this a failed request (after its retries) would leave the skeleton up forever.
              <div
                className={cn(
                  'grid justify-items-center rounded-xl border border-dashed px-4 py-6 text-center',
                  fade(collapsed),
                )}
              >
                <p className="text-[13px] font-medium">Couldn't load matches</p>
                <Button
                  variant="ghost"
                  size="xs"
                  className="mt-2"
                  onClick={() => void refetch()}
                  loading={isFetching}
                >
                  Try again
                </Button>
              </div>
            ) : (
              showSkeleton && (
                // Laid out like RecentRow: map icon, name and age, score on the right.
                <div className="grid gap-0.5" aria-hidden>
                  {SKELETON_WIDTHS.map((width, i) => (
                    <div key={i} className="flex h-10 items-center gap-2.5 px-2">
                      <Skeleton className="size-6 shrink-0 rounded-full" />
                      <span
                        className={cn('flex min-w-0 flex-1 items-center gap-2', fade(collapsed))}
                      >
                        <span className="flex flex-1 items-center gap-1.5">
                          <Skeleton className={cn('h-3.5 rounded', width)} />
                          <Skeleton className="h-2.5 w-4 rounded" />
                        </span>
                        <Skeleton className="h-3 w-8 rounded" />
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </FadeSwap>
        </div>
      </div>

      {/*
       * The rail has no room beside the account, so the queue goes above it. It slides there on
       * the sidebar's own curve (and the footer grows to fit) instead of the row reflowing at once.
       */}
      <div
        className={cn(
          'relative flex shrink-0 items-center border-t p-2',
          '[transition:padding_200ms_var(--ease-out-quart)] motion-reduce:transition-none',
          collapsed && 'pt-[52px]',
        )}
      >
        <Menu.Root>
          <Menu.Trigger
            render={
              <Button
                variant="ghost"
                className={cn(
                  // A compact pill sized to the name; the email lives in the menu.
                  'h-10 max-w-full justify-start gap-2 overflow-hidden rounded-lg px-1.5 text-left font-normal text-foreground hover:text-foreground',
                  // Narrows with the rail rather than at once, so the name fades instead of being cut.
                  'transition-[max-width] duration-200 ease-out-quart motion-reduce:transition-none',
                  collapsed && 'max-w-10',
                )}
              />
            }
          >
            <Avatar src={avatar} name={me.user.name} className="size-7" />
            <span className={cn('flex min-w-0 items-center gap-3 pr-1.5', fade(collapsed))}>
              <span className="truncate text-sm font-medium">{me.user.name}</span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="top" align="start" sideOffset={6} className="z-50">
              <Menu.Popup className="w-56 origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
                <p className="truncate px-2 pt-1 pb-1.5 text-[13px] text-muted">{subtitle}</p>
                {me.user.isAdmin && (
                  <Menu.Item
                    className={menuItemClass}
                    onClick={() => {
                      onNavigate?.()
                      void navigate({ to: '/admin', viewTransition })
                    }}
                  >
                    <Server /> Manage instance
                  </Menu.Item>
                )}
                <Menu.Item
                  className={menuItemClass}
                  onClick={() => {
                    onNavigate?.()
                    void navigate({ to: '/settings', viewTransition })
                  }}
                >
                  <Settings /> Settings
                </Menu.Item>
                <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                <Menu.Item className={menuItemClass} onClick={signOut}>
                  <LogOut /> Sign out
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <QueueButton
          onNavigate={onNavigate}
          viewTransition={viewTransition}
          className={cn(
            'absolute right-2 bottom-2',
            'transition-[color,translate] duration-200 ease-out-quart motion-reduce:transition-none',
            // Collapsing only happens in the desktop sidebar, whose content is always w-64: from
            // the right edge to the rail's 8px inset is 256 − 56, and up one button plus the gap.
            collapsed && '-translate-x-[200px] -translate-y-11',
          )}
        />
      </div>
    </div>
  )
}
