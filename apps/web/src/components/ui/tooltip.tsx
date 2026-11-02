import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
          <BaseTooltip.Popup
            className={cn(
              'max-w-72 origin-(--transform-origin) rounded-lg border bg-surface px-2.5 py-1.5 text-label shadow-xl shadow-black/20',
              'transition-[scale,opacity] duration-150 ease-out-quart',
              'data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0',
              // Following the pointer between triggers, it moves instead of popping out and in.
              'data-instant:transition-none',
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
