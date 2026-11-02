import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, type Ref, useLayoutEffect, useRef, useState } from 'react'
import { EASE_OUT_QUART } from '@/lib/motion'
import { observeResize } from '@/lib/resizeObserve'
import { cn } from '@/lib/utils'

/**
 * Enter/exit for list items: they fade in and out at full size, never clipped, while the items
 * around them slide to their new place (`layout`). Spread onto any motion element.
 */
export const fade = {
  layout: 'position',
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.3, ease: EASE_OUT_QUART },
} as const

/**
 * A list whose items fade in and out. Leaving items are popped out of the flow as they fade, so
 * the rest slides into the gap at once. Items there on first render don't animate in. Children
 * must be keyed `FadeItem`s (or motion elements spreading `fade`).
 */
export const FadeList = ({ children }: { children: ReactNode }) => (
  <AnimatePresence initial={false} mode="popLayout">
    {children}
  </AnimatePresence>
)

export const FadeItem = ({
  ref,
  className,
  children,
}: {
  ref?: Ref<HTMLDivElement>
  className?: string
  children: ReactNode
}) => (
  // min-w-0: as a grid or flex item it may shrink, so long text inside truncates.
  <motion.div ref={ref} className={cn('min-w-0', className)} {...fade}>
    {children}
  </motion.div>
)

/**
 * A box whose height follows its content smoothly instead of snapping, so whatever is below it
 * slides too. Nothing is clipped: content that grows shows at once (fading in, if it's a
 * `FadeItem`), and the box catches up. Put borders, padding and background on it via `className`;
 * its height is the content's (content-box), so they sit outside.
 */
export const AutoHeight = ({
  className,
  innerClassName,
  children,
}: {
  className?: string
  /** For the content's own layout (a flex column with gaps), so items stay its direct children. */
  innerClassName?: string
  children: ReactNode
}) => {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const reduce = useReducedMotion()

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- observes the content's size so the box's height follows it
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return

    return observeResize(el, ([entry]) => setHeight(entry!.borderBoxSize[0]!.blockSize))
  }, [])

  return (
    <motion.div
      className={cn('box-content', className)}
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : fade.transition}
    >
      <div ref={inner} className={innerClassName}>
        {children}
      </div>
    </motion.div>
  )
}

/**
 * One element that fades in and out with `show` (a list's whole section). Its box eases between
 * the content's height and none, so what's below slides along.
 */
export const Presence = ({
  show,
  className,
  children,
}: {
  show: boolean
  className?: string
  children: ReactNode
}) => (
  <AutoHeight className={className}>
    <FadeList>{show && <FadeItem key="only">{children}</FadeItem>}</FadeList>
  </AutoHeight>
)
