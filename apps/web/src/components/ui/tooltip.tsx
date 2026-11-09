import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
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
  side?: 'top' | 'right' | 'bottom' | 'left'
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

const CURSOR_GAP = 12

/**
 * A hover label that follows the cursor across all of `trigger` once `armed`, positioned above
 * the cursor until the cursor leaves it or `armed` drops; the caller decides when, delay included.
 */
export const CursorTooltip = ({
  content,
  trigger,
  armed,
  className,
}: {
  content: ReactNode
  trigger: ReactElement<Record<string, unknown>>
  armed: boolean
  className?: string
}) => (
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
    <BaseTooltip.Trigger render={trigger} delay={0} closeOnClick={false} />
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        side="top"
        sideOffset={CURSOR_GAP}
        positionMethod="fixed"
        className="z-50"
      >
        <BaseTooltip.Popup className={cn(POPUP, className)}>{content}</BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  </BaseTooltip.Root>
)
