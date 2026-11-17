import { ScrollArea } from '@base-ui/react/scroll-area'
import { cn } from '@/lib/utils'

/**
 * A thin overlay scrollbar for `ScrollArea.Root`, shown while hovered or scrolling. Hidden on touch,
 * where the platform draws its own indicator and this one would double it.
 */
export const Scrollbar = ({
  orientation,
  className,
}: {
  orientation: 'vertical' | 'horizontal'
  /** Placement only: margins, position, z-index. */
  className?: string
}) => {
  const vertical = orientation === 'vertical'

  return (
    <ScrollArea.Scrollbar
      orientation={orientation}
      className={cn(
        'flex rounded-full opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0 pointer-coarse:hidden motion-reduce:transition-none',
        vertical ? 'w-1.5 justify-center' : 'h-1.5 items-center',
        className,
      )}
    >
      <ScrollArea.Thumb
        className={cn('rounded-full bg-foreground/25', vertical ? 'w-full' : 'h-full')}
      />
    </ScrollArea.Scrollbar>
  )
}
