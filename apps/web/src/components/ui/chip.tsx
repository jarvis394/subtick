import { Toggle } from '@base-ui/react/toggle'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** An on/off pill for picking values out of a set, such as filter tags. */
export const Chip = ({
  className,
  ...props
}: Omit<ComponentProps<typeof Toggle>, 'className'> & { className?: string }) => (
  <Toggle
    className={cn(
      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border-strong px-2.5 text-small text-muted outline-none select-none',
      // A trailing icon (a remove ×) carries its own whitespace, so the edge beside it is tighter.
      'has-[>svg:last-child]:pr-1.5',
      'transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
      'data-pressed:border-transparent data-pressed:bg-foreground data-pressed:text-background data-pressed:hover:bg-contrast-hover',
      '[&_svg]:size-3.5 [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
)
