import { cn } from '@/lib/utils'

/**
 * Nudged up 0.075em: the serif's lowercase body sits ~2px below the line box's center at 20px,
 * so a mathematically centered wordmark reads as low next to icons and buttons.
 */
export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-block -translate-y-[0.075em] font-serif text-xl tracking-tight text-foreground',
      className,
    )}
  >
    subtick<span className="text-brand">.</span>
  </span>
)
