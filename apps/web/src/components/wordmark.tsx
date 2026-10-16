import { cn } from '@/lib/utils'

export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn('font-serif text-xl tracking-tight text-foreground', className)}>
    subtick<span className="text-accent">.</span>
  </span>
)
