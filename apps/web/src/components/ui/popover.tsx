import { Popover as BasePopover } from '@base-ui/react/popover'
import { type ReactElement, type ReactNode, useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { useHandheld } from '@/hooks/use-handheld'
import { cn } from '@/lib/utils'

const popupClass =
  'origin-(--transform-origin) rounded-xl border bg-surface shadow-xl shadow-black/20 outline-none transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100'

/**
 * A panel that floats beside its trigger on desktop and rises as a bottom sheet on phones and
 * tablets. `trigger` is the element to render as the trigger, children included.
 */
export const Popover = ({
  trigger,
  title,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  className,
}: {
  trigger: ReactElement
  /** Names the panel for assistive tech. */
  title: string
  children: ReactNode
  side?: 'bottom' | 'top' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Layout for the desktop popup, such as its size; the sheet sizes itself. */
  className?: string
}) => {
  const sheet = useHandheld()
  const [open, setOpen] = useState(false)

  if (sheet) {
    return (
      <Sheet
        title={title}
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        // Lines content up with the text of sheet rows, which sit 20px in.
        className="px-5 py-4"
      >
        {children}
      </Sheet>
    )
  }

  return (
    <BasePopover.Root open={open} onOpenChange={setOpen}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
          <BasePopover.Popup className={cn(popupClass, className)}>
            <BasePopover.Title className="sr-only">{title}</BasePopover.Title>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
