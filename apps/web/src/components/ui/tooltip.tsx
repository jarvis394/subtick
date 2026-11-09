import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { type ReactElement, type ReactNode, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const POPUP = cn(
  'max-w-72 origin-(--transform-origin) rounded-lg border bg-surface px-2.5 py-1.5 text-label shadow-xl shadow-black/20',
  'transition-[scale,opacity] duration-150 ease-out-quart',
  'data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
  'motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100',
  // Following the pointer between triggers, it moves instead of popping out and in.
  'data-instant:transition-none',
)

/**
 * A hover label for `trigger` (rendered as the trigger element itself, so no extra wrapper).
 * Without `content` it renders `trigger` alone.
 */
export const Tooltip = ({
  content,
  trigger,
  side = 'top',
  align = 'center',
  className,
}: {
  content: ReactNode
  trigger: ReactElement<Record<string, unknown>>
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  className?: string
}) =>
  content == null || content === '' ? (
    trigger
  ) : (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={trigger} delay={300} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={8} className="z-50">
          <BaseTooltip.Popup className={cn(POPUP, className)}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )

const CURSOR_GAP = 16
const FLIP_BACK_SLACK = 24
// Unmeasured until it first opens; the popup's max width errs towards having room.
const UNMEASURED_WIDTH = 288

/**
 * A hover label that follows the cursor across all of `trigger` once `armed`, until the cursor
 * leaves it or `armed` drops; the caller decides when, delay included. It stays inside `boundary`:
 * out of room on the right it glides to the cursor's left, so it never covers what the cursor
 * points at.
 */
export const CursorTooltip = ({
  content,
  trigger,
  armed,
  boundary,
  className,
}: {
  content: ReactNode
  trigger: ReactElement<Record<string, unknown>>
  armed: boolean
  boundary: Element[]
  className?: string
}) => {
  const [flipped, setFlipped] = useState(false)
  const popup = useRef<HTMLDivElement>(null)

  const placeFor = (clientX: number) => {
    const width = popup.current?.offsetWidth ?? UNMEASURED_WIDTH
    const right = Math.min(
      window.innerWidth,
      ...boundary.map((el) => el.getBoundingClientRect().right),
    )
    const room = right - clientX - CURSOR_GAP - width

    setFlipped((was) => room < (was ? FLIP_BACK_SLACK : 0))
  }

  return (
    <BaseTooltip.Root
      open={armed}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && armed) {
          eventDetails.cancel()
        }
      }}
      trackCursorAxis="both"
      disableHoverablePopup
    >
      <BaseTooltip.Trigger
        render={trigger}
        delay={0}
        closeOnClick={false}
        onPointerMove={(e) => placeFor(e.clientX)}
      />
      <BaseTooltip.Portal>
        {/* The positioner tracks the cursor; the popup's own translate does the flip, because
            percent of its own width can animate where the positioner's coordinates can't. */}
        <BaseTooltip.Positioner
          side="right"
          sideOffset={CURSOR_GAP}
          positionMethod="fixed"
          collisionBoundary={boundary}
          collisionPadding={0}
          collisionAvoidance={{ side: 'none', align: 'shift' }}
          className="z-50"
        >
          <BaseTooltip.Popup
            ref={popup}
            style={{ translate: flipped ? `calc(-100% - ${CURSOR_GAP * 2}px)` : undefined }}
            className={cn(
              POPUP,
              'transition-[scale,opacity,translate] motion-reduce:transition-[opacity]',
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
