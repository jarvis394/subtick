import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Clapperboard, PanelLeft, Swords } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { SessionsIcon } from '@/components/sessions/sessions-icon'
import { Button, IconButton } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { meQuery, queueQuery } from '@/lib/queries'
import { isSetUp } from '@/lib/setup'
import { cn } from '@/lib/utils'
import { AccountMenu } from './account-menu'
import { QueueButton } from './queue-button'
import { Recents } from './recents'
import { NavItem, fade } from './rows'

/**
 * Geometry is identical expanded and collapsed: the sidebar keeps its full-width layout and the
 * rail (56px) just clips it. Every icon is centered on x = 28px, so nothing moves while the width
 * animates; labels only fade. Rows shrink to squares (40px, 44px handheld) so hover states stay tidy in the rail.
 */
export const RAIL_WIDTH = 'w-14'

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
  const setUp = isSetUp(me)
  // Same query as the queue button, which hides itself while the queue is empty.
  const { data: queue } = useQuery(queueQuery)
  const queueShown = Boolean(queue?.items.length)

  return (
    <div className="flex h-full w-full min-w-64 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-1.5 px-3">
        <Link
          to="/"
          onClick={onNavigate}
          viewTransition={viewTransition}
          tabIndex={collapsed ? -1 : undefined}
          className={cn(
            'mr-auto flex items-center gap-2 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            fade(collapsed),
          )}
        >
          <BrandMark />
          <Wordmark />
        </Link>
        {!setUp && (
          <Button
            size="xs"
            render={<Link to="/setup" onClick={onNavigate} viewTransition={viewTransition} />}
            tabIndex={collapsed ? -1 : undefined}
            className={fade(collapsed)}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Finish setup
          </Button>
        )}
        {onToggle && (
          <IconButton
            size="sm"
            label={toggleLabel ?? (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            onClick={onToggle}
            className={cn(
              'transition-[color,translate] duration-200 ease-out-quart motion-reduce:transition-none',
              // Like the refresh button, it slides into the rail centered on x = 28px: the content
              // stays w-64, so from 212px in (12px padding plus the 32px button) to 12px is 200px.
              collapsed && '-translate-x-50',
            )}
          >
            <PanelLeft />
          </IconButton>
        )}
      </div>

      {/* Header and footer hold still; everything between them scrolls as one. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-2">
        <nav className="grid px-1.5 desktop:px-2">
          <NavItem
            to="/"
            icon={<Clapperboard />}
            label="Highlights"
            collapsed={collapsed}
            onNavigate={onNavigate}
            viewTransition={viewTransition}
          />
          <NavItem
            to="/sessions"
            icon={<SessionsIcon />}
            label="Sessions"
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

        <Recents
          collapsed={collapsed}
          setUp={setUp}
          onNavigate={onNavigate}
          viewTransition={viewTransition}
        />
      </div>

      {/*
       * The rail has no room beside the account, so the queue goes above it. It slides there on
       * the sidebar's own curve (and the footer grows to fit) instead of the row reflowing at once.
       * No queue, no room kept for it.
       */}
      <div
        className={cn(
          'relative flex shrink-0 items-center border-t p-2',
          '[transition:padding_200ms_var(--ease-out-quart)] motion-reduce:transition-none',
          collapsed && queueShown && 'pt-13',
        )}
      >
        <AccountMenu
          collapsed={collapsed}
          onNavigate={onNavigate}
          viewTransition={viewTransition}
        />
        <QueueButton
          onNavigate={onNavigate}
          viewTransition={viewTransition}
          className={cn(
            'absolute right-2 bottom-2',
            'transition-[color,translate] duration-200 ease-out-quart motion-reduce:transition-none',
            // Collapsing only happens in the desktop sidebar, whose content is always w-64: from
            // the right edge to the rail's 8px inset is 256 − 56, and up one button plus the gap.
            collapsed && '-translate-x-50 -translate-y-11',
          )}
        />
      </div>
    </div>
  )
}
