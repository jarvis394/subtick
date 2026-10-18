import { Dialog } from '@base-ui/react/dialog'
import { Menu as MenuIcon } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { RAIL_WIDTH, SidebarContent } from '@/components/sidebar'
import { ButtonLayer, buttonClass } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMatchEvents } from '@/hooks/use-match-events'
import { cn } from '@/lib/utils'

/** Sidebar on md+, a top bar with a slide-in drawer below that. */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useLocalStorage('subtick:sidebar-collapsed', false)
  const [drawerOpen, setDrawerOpen] = useState(false)
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
    <div className="flex min-h-dvh select-none">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r bg-surface/50 transition-[width,opacity] duration-200 ease-out-quart starting:opacity-0 md:block motion-reduce:transition-none',
          collapsed ? RAIL_WIDTH : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      <div className="@container min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-2 backdrop-blur-md md:hidden">
          <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Dialog.Trigger
              aria-label="Open menu"
              // A ghost icon button, so its background presses in like every other button's.
              className={buttonClass('ghost', 'icon', 'size-10 rounded-lg [&_svg]:size-5')}
            >
              <ButtonLayer />
              <MenuIcon />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
              <Dialog.Popup
                ref={drawerRef}
                // Keyboard users land on the first link; a tap focuses the panel itself so no
                // focus ring appears on the logo.
                initialFocus={(type) => (type === 'keyboard' ? true : drawerRef.current)}
                className={cn(
                  'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r bg-background outline-none',
                  'transition-transform duration-300 ease-drawer data-ending-style:duration-200',
                  'data-ending-style:-translate-x-full data-starting-style:-translate-x-full',
                  // Reduced motion: fade in place instead of sliding across the screen.
                  'motion-reduce:transition-opacity motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-starting-style:translate-x-0',
                  'motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0',
                )}
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <SidebarContent collapsed={false} onNavigate={() => setCloseOnArrival(true)} />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Wordmark />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  )
}
