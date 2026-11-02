import { Drawer } from '@base-ui/react/drawer'
import { Menu as MenuIcon } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { type ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { RAIL_WIDTH, SidebarContent } from '@/components/sidebar'
import { IconButton } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMatchEvents } from '@/hooks/use-match-events'
import { cn } from '@/lib/utils'

/** Dev builds only; the import is dropped from production bundles. */
const DevMenu = import.meta.env.DEV ? lazy(() => import('@/components/dev-menu')) : null

/**
 * Sidebar on md+, a top bar with a full-screen drawer below that.
 *
 * The drawer sits under the page and the page slides right off it (Gemini-style): opening pushes
 * the page out while the drawer's content settles in place from 98% scale and 0.8 opacity; a
 * swipe left on the drawer drags the page back over it, following the finger. `Drawer.Indent`
 * carries the live swipe progress (0 open, 1 closed) and `data-active` while the drawer is open.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useLocalStorage('subtick:sidebar-collapsed', false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLayer, setDrawerLayer] = useState<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  // A tap in the drawer keeps it open (its row shimmering) until the new page has loaded, so the
  // drawer doesn't slide away to reveal the old page still sitting there.
  const [closeOnArrival, setCloseOnArrival] = useState(false)
  const navigating = useRouterState({ select: (s) => s.status === 'pending' })
  useEffect(() => {
    if (!closeOnArrival || navigating) return
    setCloseOnArrival(false)
    setDrawerOpen(false)
  }, [closeOnArrival, navigating])
  useMatchEvents()

  return (
    <Drawer.Provider>
      <Drawer.Indent
        // styles.css keys the page-transition backdrop off this.
        data-app-shell=""
        className={cn(
          'group/indent relative overflow-x-clip',
          // Base UI's `--drawer-swipe-progress` doesn't inherit (and the popup resets it for
          // itself), so the page and the drawer's content read this copy instead.
          '[--nav-progress:var(--drawer-swipe-progress)]',
          // Instant while a finger drags (progress > 0), the drawer's settle otherwise. Keyed off
          // progress rather than `data-swiping`, which outlives the release by a moment and would
          // snap the drawer's content instead of easing it.
          '[--nav-duration:calc(400ms*(1-clamp(0,var(--drawer-swipe-progress)*100000,1)))]',
        )}
      >
        {/* The drawer portals in here, under the page (which stacks above it with z-10). */}
        <div ref={setDrawerLayer} />

        <div
          className={cn(
            // The page is the raised surface; the sidebar and the drawer sit on the background.
            'relative z-10 flex min-h-dvh bg-surface select-none',
            // Pushed fully off to the right while open, less the swipe progress while dragged back.
            'max-md:group-data-active/indent:[translate:calc(100%*(1-var(--nav-progress)))_0]',
            '[transition:translate_var(--nav-duration)_var(--ease-drawer)]',
            'motion-reduce:[transition:none]',
          )}
        >
          {/* The sidebar is fixed, so page overscroll doesn't drag it; this keeps its place in the row. */}
          <div
            className={cn(
              'hidden shrink-0 transition-[width] duration-200 ease-out-quart md:block motion-reduce:transition-none',
              collapsed ? RAIL_WIDTH : 'w-64',
            )}
          >
            {/* Captured apart from the page (class `chrome`), so page transitions leave it in place. */}
            <aside
              className={cn(
                '[view-transition-class:chrome] [view-transition-name:sidebar]',
                'fixed top-0 left-0 h-dvh overflow-hidden border-r bg-background transition-[width,opacity] duration-200 ease-out-quart starting:opacity-0 motion-reduce:transition-none',
                collapsed ? RAIL_WIDTH : 'w-64',
              )}
            >
              <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            </aside>
          </div>

          <div className="@container min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex h-14 [view-transition-class:chrome] [view-transition-name:mobile-header] items-center gap-2 border-b bg-surface/85 px-2 backdrop-blur-md md:hidden">
              <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="left">
                <Drawer.Trigger render={<IconButton size="lg" label="Open menu" tooltip={false} />}>
                  <MenuIcon />
                </Drawer.Trigger>
                <Drawer.Portal container={drawerLayer}>
                  <Drawer.Viewport className="fixed inset-0 md:hidden">
                    <Drawer.Popup
                      ref={drawerRef}
                      // Keyboard users land on the first link; a tap focuses the panel itself so
                      // no focus ring appears on the logo.
                      initialFocus={(type) => (type === 'keyboard' ? true : drawerRef.current)}
                      className={cn(
                        'group/drawer h-full w-full overflow-hidden bg-background outline-none touch-auto select-none',
                        // Base UI drags the popup with an inline transform; it stays centred here
                        // and only scales and fades, while the page is what moves.
                        'transform-none!',
                        // The visible motion is the page's and the content's; this near-invisible
                        // fade only keeps the popup mounted until the page has slid back over it.
                        'transition-opacity duration-400 data-ending-style:opacity-[0.9999]',
                      )}
                    >
                      <div
                        className={cn(
                          'h-full',
                          // Settles from 98% / 0.8 as the page leaves, and back as it's dragged in.
                          '[scale:calc(1-0.02*var(--nav-progress))] opacity-[calc(1-0.2*var(--nav-progress))]',
                          'group-data-starting-style/drawer:[scale:0.98] group-data-starting-style/drawer:opacity-80',
                          'group-data-ending-style/drawer:[scale:0.98] group-data-ending-style/drawer:opacity-80',
                          '[transition:scale_var(--nav-duration)_var(--ease-drawer),opacity_var(--nav-duration)_var(--ease-drawer)]',
                          // A swipe dismissal sets the ending style a frame before it zeroes the
                          // progress, so the close would otherwise snap rather than ease.
                          'group-data-ending-style/drawer:[transition-duration:400ms]',
                          'motion-reduce:transition-none',
                        )}
                      >
                        <Drawer.Title className="sr-only">Navigation</Drawer.Title>
                        <SidebarContent
                          collapsed={false}
                          onToggle={() => setDrawerOpen(false)}
                          toggleLabel="Close menu"
                          onNavigate={() => setCloseOnArrival(true)}
                          viewTransition={false}
                        />
                      </div>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
              <Link
                to="/"
                className="rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Wordmark />
              </Link>
            </header>
            <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</main>
          </div>
        </div>
      </Drawer.Indent>
      {DevMenu && (
        <Suspense>
          <DevMenu />
        </Suspense>
      )}
    </Drawer.Provider>
  )
}
