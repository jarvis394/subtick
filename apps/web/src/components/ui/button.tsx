import { Button as BaseButton } from '@base-ui/react/button'
import { useRender } from '@base-ui/react/use-render'
import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Every button is one variant (how loud) × one tone (what it means) × one size.
 *
 * Variant
 * - `primary`: the one main action of a surface (Continue, Record, Create). The page's own
 *   foreground as the fill: black on light, white on dark.
 * - `secondary`: every other real action. The default.
 * - `ghost`: dismissing and low-key actions (Cancel, Skip, Done), and icon buttons in chrome.
 * - `link`: inline in a sentence; no box, no size.
 *
 * Tone
 * - `neutral`: the default.
 * - `danger`: destructive. `primary` only for the final confirm (Delete account); `ghost` for the
 *   entry points (Delete, Sign out, Unlink, Cancel recording).
 * - `brand`: needs attention without alarm (retry a failed recording), usually `secondary`.
 */
const styles = {
  primary: {
    neutral:
      'text-background [--bg:var(--color-foreground)] [--bg-hover:var(--color-contrast-hover)]',
    danger:
      'text-white [--bg:var(--color-danger-solid)] [--bg-hover:var(--color-danger-solid-hover)]',
    brand: 'text-white [--bg:var(--color-brand)] [--bg-hover:var(--color-brand-solid-hover)]',
  },
  secondary: {
    neutral: 'text-foreground [--bg:var(--color-surface-2)] [--bg-hover:var(--color-surface-3)]',
    danger:
      'text-danger [--bg:var(--color-danger-soft)] [--bg-hover:var(--color-danger-soft-hover)]',
    brand: 'text-brand [--bg:var(--color-brand-soft)] [--bg-hover:var(--color-brand-soft-hover)]',
  },
  ghost: {
    neutral: cn(
      'text-muted [--bg:transparent] [--bg-hover:var(--color-surface-2)]',
      // Muted at rest; full color while hovered or selected.
      'hover:text-foreground aria-pressed:text-foreground aria-[current=page]:text-foreground data-popup-open:text-foreground',
    ),
    danger: 'text-danger [--bg:transparent] [--bg-hover:var(--color-surface-2)]',
    brand: 'text-brand [--bg:transparent] [--bg-hover:var(--color-brand-soft)]',
  },
  link: {
    neutral: 'text-accent',
    danger: 'text-danger',
    brand: 'text-brand',
  },
}

const sizes = {
  xs: 'h-7 gap-1 rounded-md px-2 text-[12px] [&_svg]:size-3.5',
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-control px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
}

/**
 * Square, with the glyph growing with the button. The small two get a wider hit area (the
 * pseudo-element) so a slightly-off tap still lands.
 */
const iconSizes = {
  xs: 'size-7 rounded-md [&_svg]:size-3.5 after:absolute after:-inset-1.5',
  sm: 'size-8 rounded-lg [&_svg]:size-4 after:absolute after:-inset-1',
  md: 'size-9 rounded-control [&_svg]:size-[18px]',
  lg: 'size-10 rounded-lg [&_svg]:size-5',
}

export type ButtonVariant = keyof typeof styles
export type ButtonTone = 'neutral' | 'danger' | 'brand'
export type ButtonSize = keyof typeof sizes

const boxClass = (variant: Exclude<ButtonVariant, 'link'>, tone: ButtonTone, size: string) =>
  cn(
    'group/button relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap select-none',
    // Text color (ghost's muted -> foreground) fades with the background layer, not instantly.
    'transition-[color] duration-150 ease-out',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    // Loading is disabled too, but keeps full color: the spinner is the feedback.
    'disabled:cursor-not-allowed data-disabled:cursor-not-allowed disabled:not-aria-busy:opacity-50 data-disabled:not-aria-busy:opacity-50 aria-busy:cursor-wait',
    // Selected (a pressed toggle, an open menu, the current page): lit like a hovered button.
    'aria-pressed:[--bg:var(--bg-hover)] aria-[current=page]:[--bg:var(--bg-hover)] data-popup-open:[--bg:var(--bg-hover)]',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    styles[variant][tone],
    size,
  )

const linkClass = (tone: ButtonTone) =>
  cn(
    'cursor-pointer rounded-sm underline decoration-current/40 underline-offset-2 outline-none',
    'transition-[text-decoration-color] duration-150 hover:decoration-current focus-visible:decoration-current',
    'disabled:cursor-not-allowed disabled:opacity-50',
    styles.link[tone],
  )

/**
 * Two layers: the background is its own element and scales down on press, the label does not.
 * That keeps text crisp while the button still "gives". Only `scale` (compositor-only) animates;
 * Tailwind 4's `scale-*` utilities set the `scale` property, not `transform`.
 */
const ButtonLayer = () => (
  <span
    aria-hidden
    className={cn(
      'absolute inset-0 -z-10 rounded-[inherit] bg-(--bg)',
      // Press moves (strong ease-out); hover only recolors (plain ease).
      '[transition:scale_160ms_var(--ease-out-quart),background-color_150ms_ease]',
      'group-hover/button:bg-(--bg-hover) group-active/button:scale-[0.96]',
      'group-disabled/button:scale-100 group-data-disabled/button:scale-100',
      // Reduced motion: no press movement, keep the color fade.
      'motion-reduce:group-active/button:scale-100',
    )}
  />
)

/**
 * The label hides (but stays in place, so the width holds, and stays readable to screen readers)
 * while a spinner shows over it. Only wrapped when `loading` is passed at all, so buttons that
 * never load keep their children as direct flex items.
 */
const Busy = ({ loading, children }: { loading: boolean; children: ReactNode }) => (
  <>
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-[inherit] transition-opacity duration-150',
        loading && 'opacity-0',
      )}
    >
      {children}
    </span>
    {loading && (
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <span className="size-[1.15em] animate-spin rounded-full border-2 border-current border-r-transparent opacity-70" />
      </span>
    )}
  </>
)

/** Another element (a router `<Link />`) styled as a button. It keeps its own semantics. */
const Rendered = ({
  render,
  props: { ref, ...props },
}: {
  render: ReactElement
  props: { ref?: Ref<HTMLElement> } & Record<string, unknown>
}) => useRender({ render, ref, props })

export interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  'className' | 'render'
> {
  variant?: ButtonVariant
  tone?: ButtonTone
  size?: ButtonSize
  /** Shows a spinner over the label and blocks clicks, without dimming or changing the width. */
  loading?: boolean
  /** Renders as this element instead, e.g. `render={<Link to="/setup" />}`. */
  render?: ReactElement
  className?: string
}

const ButtonRoot = ({
  className,
  variant,
  loading,
  render,
  disabled,
  focusableWhenDisabled,
  children,
  ...props
}: Omit<ButtonProps, 'tone' | 'size'>) => {
  const content =
    variant === 'link' ? (
      children
    ) : (
      <>
        <ButtonLayer />
        {loading === undefined ? children : <Busy loading={loading}>{children}</Busy>}
      </>
    )
  if (render) return <Rendered render={render} props={{ ...props, className, children: content }} />
  return (
    <BaseButton
      className={className}
      disabled={disabled || loading}
      // Keeps focus on the button while it loads instead of dropping it to the page.
      focusableWhenDisabled={focusableWhenDisabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </BaseButton>
  )
}

export const Button = ({
  variant = 'secondary',
  tone = 'neutral',
  size = 'md',
  className,
  ...props
}: ButtonProps) => (
  <ButtonRoot
    variant={variant}
    className={cn(
      variant === 'link' ? linkClass(tone) : boxClass(variant, tone, sizes[size]),
      className,
    )}
    {...props}
  />
)

export interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
  /** What the button does: its accessible name and its tooltip. */
  label: string
  variant?: 'ghost' | 'secondary'
  /** `false` when the trigger already has a richer tooltip of its own, or its label is obvious. */
  tooltip?: boolean
  children?: ReactNode
}

export const IconButton = ({
  label,
  variant = 'ghost',
  tone = 'neutral',
  size = 'md',
  tooltip = true,
  className,
  ...props
}: IconButtonProps) => {
  const button = (
    <ButtonRoot
      aria-label={label}
      variant={variant}
      className={cn(boxClass(variant, tone, iconSizes[size]), className)}
      {...props}
    />
  )
  return tooltip ? <Tooltip content={label} trigger={button} /> : button
}
