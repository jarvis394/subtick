import { cn } from '@/lib/utils'

/** A killfeed icon, tinted with the current text color. */
export const KillfeedIcon = ({ src, className }: { src: string; className?: string }) => (
  <span
    aria-hidden
    className={cn('size-3 shrink-0 bg-current', className)}
    style={{
      WebkitMask: `url("${src}") center / contain no-repeat`,
      mask: `url("${src}") center / contain no-repeat`,
    }}
  />
)
