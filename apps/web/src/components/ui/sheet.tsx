import { Drawer } from '@base-ui/react/drawer'
import { type ReactElement, type ReactNode, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * A bottom sheet for phones and tablets that closes on a downward swipe. `trigger` is the element
 * to render as the trigger, children included.
 */
export const Sheet = ({
  trigger,
  title,
  open,
  onOpenChange,
  children,
  className,
}: {
  trigger: ReactElement
  /** Names the sheet for assistive tech. */
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Layout for the sheet's content, such as its padding. */
  className?: string
}) => {
  const popup = useRef<HTMLDivElement>(null)

  return (
    // Its own provider, so the app shell's page doesn't slide away as it does for the nav drawer.
    <Drawer.Provider>
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Trigger render={trigger} />
        <Drawer.Portal>
          {/* Base UI skips the backdrop of a drawer nested in another (the nav drawer) unless forced. */}
          <Drawer.Backdrop
            forceRender
            className="fixed inset-0 z-50 bg-black/40 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-400 ease-drawer data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-none"
          />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup
              ref={popup}
              // A tap focuses the sheet itself, so no ring lands on the first row and no keyboard
              // pops up for a search field; keyboard users still land on the first control.
              initialFocus={(type) => (type === 'keyboard' ? true : popup.current)}
              className="relative flex max-h-[85dvh] w-full max-w-lg touch-auto flex-col rounded-t-3xl border-t bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/20 outline-none after:absolute after:inset-x-0 after:top-full after:h-dvh after:bg-surface [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-400 ease-drawer data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-none"
            >
              {/* Swiped up, the sheet stretches past its edge; the fill below keeps the gap covered. */}
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              <Drawer.Content
                className={cn(
                  'min-h-0 overflow-y-auto overscroll-contain rounded-t-[inherit] p-2 [scrollbar-gutter:stable_both-edges]',
                  className,
                )}
              >
                {children}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </Drawer.Provider>
  )
}
