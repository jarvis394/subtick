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
import type { ReactNode } from 'react'
import { FadeSwap } from '@/components/fade-swap'
import { MapIcon } from '@/components/map-icon'
import { perspectiveScore } from '@/components/match-table'
import { isProcessing } from '@/components/match-status'
import { Avatar } from '@/components/ui/avatar'
import { ButtonLayer, buttonClass } from '@/components/ui/button'
import { Skeleton, Spinner } from '@/components/ui/surface'
import { Wordmark } from '@/components/wordmark'
import { authClient } from '@/lib/auth'
import { shortAge } from '@/lib/format'
import { meQuery, recentMatchesQuery } from '@/lib/queries'
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
}: {
  to: '/' | '/matches'
  icon: ReactNode
  label: string
  collapsed: boolean
  onNavigate?: () => void
}) => {
  const pending = usePendingPath() === to
  return (
    <Link
      to={to}
      // Filters live in the query string; the section is active whatever they are.
      activeOptions={{ exact: true, includeSearch: false }}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(rowClass(collapsed), pending && 'shimmer')}
    >
      {icon}
      <span className={fade(collapsed)}>{label}</span>
    </Link>
  )
}

const SKELETON_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-28']

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted'

export const SidebarContent = ({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}) => {
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: recent, isError: recentFailed, refetch, isFetching } = useQuery(recentMatchesQuery)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pendingPath = usePendingPath()
  const setUp = isSetUp(me)

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
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            // A ghost icon button, so its background presses in like every other button's.
            className={buttonClass('ghost', 'icon', 'size-8 rounded-lg [&_svg]:size-[18px]')}
          >
            <ButtonLayer />
            <PanelLeft />
          </button>
        )}
        <Link
          to="/"
          onClick={onNavigate}
          tabIndex={collapsed ? -1 : undefined}
          className={cn(
            'rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            fade(collapsed),
          )}
        >
          <Wordmark />
        </Link>
        {!setUp && (
          <Link
            to="/setup"
            onClick={onNavigate}
            tabIndex={collapsed ? -1 : undefined}
            className={buttonClass(
              'secondary',
              'sm',
              cn('ml-auto h-7 rounded-md px-2 text-[12px]', fade(collapsed)),
            )}
          >
            <ButtonLayer />
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Finish setup
          </Link>
        )}
      </div>

      <nav className="grid gap-0.5 px-2">
        <NavItem
          to="/"
          icon={<Clapperboard />}
          label="Highlights"
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/matches"
          icon={<Swords />}
          label="Matches"
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
        <p
          className={cn(
            'px-[11px] pb-1.5 text-[12px] font-medium whitespace-nowrap text-muted/70',
            fade(collapsed),
          )}
        >
          Recents
        </p>
        <FadeSwap swapKey={recent ? 'ready' : recentFailed ? 'failed' : 'loading'}>
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
                {recent.items.map((match) => {
                  const score = perspectiveScore(match, match.player?.startingSide)
                  return (
                    <Link
                      key={match.id}
                      to="/matches/$id"
                      params={{ id: match.id }}
                      onClick={onNavigate}
                      title={collapsed ? mapName(match.map) : undefined}
                      className={cn(
                        rowClass(collapsed),
                        'h-10 px-2',
                        pendingPath === `/matches/${match.id}` && 'shimmer',
                      )}
                    >
                      <MapIcon map={match.map} className="size-6 rounded-md text-[12px]" />
                      <span
                        className={cn('flex min-w-0 flex-1 items-center gap-2', fade(collapsed))}
                      >
                        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                          <span className="truncate text-foreground/90">{mapName(match.map)}</span>
                          <span className="shrink-0 text-[11px] text-muted/60 tabular-nums">
                            {shortAge(match.playedAt ?? match.discoveredAt)}
                          </span>
                        </span>
                        {isProcessing(match.status) ? (
                          <Spinner className="size-3" />
                        ) : score ? (
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
                    </Link>
                  )
                })}
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
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                {isFetching && <Spinner className="size-3" />}
                Try again
              </button>
            </div>
          ) : (
            <div className="grid gap-0.5" aria-hidden>
              {SKELETON_WIDTHS.map((width, i) => (
                <div key={i} className="flex h-10 items-center gap-2 px-2">
                  <Skeleton className="size-6 shrink-0 rounded-md" />
                  <Skeleton className={cn('h-3.5 rounded-md', width, fade(collapsed))} />
                </div>
              ))}
            </div>
          )}
        </FadeSwap>
      </div>

      <div className="shrink-0 border-t p-2">
        <Menu.Root>
          <Menu.Trigger
            className={cn(
              // A compact pill sized to the name; the email lives in the menu.
              'flex h-10 max-w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-1.5 text-left outline-none',
              'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-surface-2',
              collapsed && 'w-10',
            )}
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
                      void navigate({ to: '/admin' })
                    }}
                  >
                    <Server /> Manage instance
                  </Menu.Item>
                )}
                <Menu.Item
                  className={menuItemClass}
                  onClick={() => {
                    onNavigate?.()
                    void navigate({ to: '/settings' })
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
      </div>
    </div>
  )
}
