import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE_IN_ACCELERATE, EASE_OUT_QUART, EASE_OUT_STRONG } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Mode = 'sync' | 'wait'

// Waiting fades hold the old view, then hand over fast, so the gap between views never reads as blank.
// Together they last 0.45s, the session chart's zoom, which these swaps run alongside.
const TIMING = {
  sync: {
    enter: { duration: 0.2, ease: EASE_OUT_QUART },
    exit: { duration: 0.15, ease: 'easeOut' },
  },
  wait: {
    enter: { duration: 0.3, ease: EASE_OUT_STRONG },
    exit: { duration: 0.15, ease: EASE_IN_ACCELERATE },
  },
} as const

/**
 * Crossfades views on `swapKey` change: the old view fades out in the same grid cell while the new one fades
 * in over it, and swapping back mid-fade resumes from where it was. `enterDelay` holds the fade-in so a
 * brief placeholder (a skeleton on a fast load) is never seen; `appear={false}` skips the first view's fade.
 * `mode="wait"` fades the old view out fully before the new one starts, for values that shouldn't overlap.
 */
export const FadeSwap = ({
  swapKey,
  enterDelay = 0,
  appear = true,
  mode = 'sync',
  className,
  children,
}: {
  swapKey: string
  enterDelay?: number
  appear?: boolean
  mode?: Mode
  className?: string
  children: ReactNode
}) => (
  <div className={cn('grid', className)}>
    <AnimatePresence initial={appear} mode={mode}>
      <Layer key={swapKey} enterDelay={enterDelay} mode={mode}>
        {children}
      </Layer>
    </AnimatePresence>
  </div>
)

const Layer = ({
  enterDelay,
  mode,
  children,
}: {
  enterDelay: number
  mode: Mode
  children: ReactNode
}) => {
  const present = useIsPresent()
  const { enter, exit } = TIMING[mode]

  return (
    <motion.div
      inert={!present}
      className={cn(
        'col-start-1 row-start-1 min-w-0',
        present ? 'relative z-1' : 'pointer-events-none',
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { ...enter, delay: enterDelay / 1000 } }}
      exit={{ opacity: 0, transition: exit }}
    >
      {children}
    </motion.div>
  )
}
