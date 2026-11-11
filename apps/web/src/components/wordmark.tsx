import { cn } from '@/lib/utils'

/**
 * Nudged up 0.05em: VK Sans Display's x-height centers ~0.12em below its line box's center (less for the ascenders),
 * so a mathematically centered wordmark reads as low next to icons and buttons.
 */
export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-block -translate-y-[0.05em] font-display text-heading font-medium tracking-tight text-foreground',
      className,
    )}
  >
    subtick<span className="text-brand">.</span>
  </span>
)
