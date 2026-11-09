import { Popover as BasePopover } from '@base-ui/react/popover'
import { type ReactElement, type ReactNode, useState } from 'react'
import { popupClass } from '@/components/ui/popup-styles'
import { Sheet } from '@/components/ui/sheet'
import { useSheetMode } from '@/hooks/use-handheld'
import { cn } from '@/lib/utils'

/**
 * A panel that floats beside its trigger on desktop and rises as a bottom sheet on phones and
 * tablets. `trigger` is the element to render as the trigger, children included.
 */
export const Popover = ({
  trigger,
  title,
  children,
  open: controlledOpen,
  onOpenChange,
  openOnHover,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  className,
}: {
  trigger: ReactElement
  /** Names the panel for assistive tech. */
  title: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Also opens on hover on desktop; a sheet still opens on a tap. */
  openOnHover?: boolean
  side?: 'bottom' | 'top' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Layout for the desktop popup, such as its size; the sheet sizes itself. */
  className?: string
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const sheet = useSheetMode(open)

  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

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
      <BasePopover.Trigger render={trigger} openOnHover={openOnHover} delay={200} />
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
