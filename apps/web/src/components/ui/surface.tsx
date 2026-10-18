import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('rounded-2xl border bg-surface', className)} {...props} />
)

export const Badge = ({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & {
  tone?: 'neutral' | 'accent' | 'brand' | 'success' | 'danger' | 'ct' | 't'
}) => (
  <span
    className={cn(
      'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase',
      {
        neutral: 'bg-surface-2 text-muted',
        accent: 'bg-accent/12 text-accent',
        brand: 'bg-brand/12 text-brand',
        success: 'bg-success/12 text-success',
        danger: 'bg-danger/12 text-danger',
        ct: 'bg-side-ct/14 text-side-ct',
        t: 'bg-side-t/16 text-side-t',
      }[tone],
      className,
    )}
    {...props}
  />
)

export const Spinner = ({ className }: { className?: string }) => (
  <span
    role="status"
    aria-label="Loading"
    className={cn(
      'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70',
      className,
    )}
  />
)

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />
)
