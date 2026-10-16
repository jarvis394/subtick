import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Two layers: the background is its own element and scales down on press, the label does not.
 * That keeps text crisp while the button still "gives". Only `scale` (compositor-only) animates;
 * Tailwind 4's `scale-*` utilities set the `scale` property, not `transform`.
 */
const variants = {
  primary:
    'text-accent-foreground [--bg:var(--color-accent)] [--bg-hover:var(--color-accent-hover)]',
  secondary: 'text-foreground [--bg:var(--color-surface-2)] [--bg-hover:var(--color-surface-3)]',
  outline:
    'text-foreground [--bg:transparent] [--bg-hover:var(--color-surface-2)] [--layer-border:var(--color-border-strong)]',
  ghost: 'text-muted hover:text-foreground [--bg:transparent] [--bg-hover:var(--color-surface-2)]',
  danger: 'text-white [--bg:var(--color-danger)] [--bg-hover:var(--color-danger)]',
}

const sizes = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-[10px] px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
  icon: 'size-9 rounded-[10px]',
}

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

export const buttonClass = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) =>
  cn(
    'group/button relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap select-none',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    className,
  )

/** The scaling background layer. Use inside anything styled with `buttonClass` (e.g. links). */
export const ButtonLayer = () => (
  <span
    aria-hidden
    className={cn(
      'absolute inset-0 -z-10 rounded-[inherit] border border-(--layer-border,transparent) bg-(--bg)',
      'transition-[scale,background-color] duration-200 ease-out-quart',
      'group-hover/button:bg-(--bg-hover) group-active/button:scale-[0.96]',
      'group-disabled/button:scale-100 group-data-disabled/button:scale-100 motion-reduce:transition-none',
    )}
  />
)

export interface ButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export const Button = ({ variant, size, className, children, ...props }: ButtonProps) => (
  <BaseButton
    className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)}
    {...props}
  >
    <ButtonLayer />
    {children}
  </BaseButton>
)
