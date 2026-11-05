import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('rounded-2xl border bg-surface', className)} {...props} />
)

export const Badge = ({
  tone = 'neutral',
  interactive,
  outlined,
  className,
  ...props
}: ComponentProps<'span'> & {
  /** `overlay*` tones sit on video or images; `tint-*` (dark with a hue) reads on both. */
  tone?:
    | 'neutral'
    | 'accent'
    | 'brand'
    | 'success'
    | 'danger'
    | 'ct'
    | 't'
    | 'overlay'
    | 'overlay-inverse'
    | 'tint-orange'
    | 'tint-violet'
    | 'tint-sky'
    | 'tint-teal'
  /** Links somewhere: an offset outline in its own color on hover. */
  interactive?: boolean
  /** A faint border in its own color. */
  outlined?: boolean
}) => (
  <span
    className={cn(
      'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-caption font-medium tracking-wide whitespace-nowrap uppercase',
      {
        neutral: 'bg-surface-2 text-muted',
        accent: 'bg-accent/12 text-accent',
        brand: 'bg-brand/12 text-brand-text',
        success: 'bg-success/12 text-success',
        danger: 'bg-danger/12 text-danger',
        ct: 'bg-side-ct/14 text-side-ct',
        t: 'bg-side-t/16 text-side-t-text',
        overlay: 'bg-black text-white',
        'overlay-inverse': 'bg-white text-black',
        'tint-orange': 'bg-[color-mix(in_oklab,var(--color-orange-500)_20%,black)] text-orange-300',
        'tint-violet': 'bg-[color-mix(in_oklab,var(--color-violet-500)_20%,black)] text-violet-300',
        'tint-sky': 'bg-[color-mix(in_oklab,var(--color-sky-500)_20%,black)] text-sky-400',
        'tint-teal': 'bg-[color-mix(in_oklab,var(--color-teal-500)_20%,black)] text-teal-300',
      }[tone],
      outlined && 'ring-1 ring-current/7 ring-inset',
      // An outline offset from the badge: the gap shows whatever is behind it.
      interactive &&
        'cursor-pointer outline-1 outline-offset-2 outline-transparent transition-[outline-color] duration-150 hover:outline-current/60',
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
