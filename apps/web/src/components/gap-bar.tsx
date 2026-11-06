import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** A bar growing left (worse) or right (better) from its centre; `share` 0..1 fills one half. */
export const GapBar = ({
  share,
  better,
  label,
}: {
  share: number
  better: boolean
  label: string
}) => (
  <Tooltip
    content={label}
    trigger={
      <span
        tabIndex={0}
        aria-label={label}
        className="relative block h-2 rounded-full bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/30" />
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 rounded-full',
            better ? 'left-1/2 bg-success/80' : 'right-1/2 bg-danger/70',
          )}
          style={{ width: `${Math.max(Math.min(share, 1) * 50, 1)}%` }}
        />
      </span>
    }
  />
)
