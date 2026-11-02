import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE_OUT_QUART } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Crossfades views on `swapKey` change: the old view fades out in the same grid cell while the new one fades
 * in over it, and swapping back mid-fade resumes from where it was. `enterDelay` holds the fade-in so a
 * brief placeholder (a skeleton on a fast load) is never seen; `appear={false}` skips the first view's fade.
 */
export const FadeSwap = ({
  swapKey,
  enterDelay = 0,
  appear = true,
  className,
  children,
}: {
  swapKey: string
  enterDelay?: number
  appear?: boolean
  className?: string
  children: ReactNode
}) => (
  <div className={cn('grid', className)}>
    <AnimatePresence initial={appear}>
      <Layer key={swapKey} enterDelay={enterDelay}>
        {children}
      </Layer>
    </AnimatePresence>
  </div>
)

const Layer = ({ enterDelay, children }: { enterDelay: number; children: ReactNode }) => {
  const present = useIsPresent()

  return (
    <motion.div
      inert={!present}
      className={cn(
        'col-start-1 row-start-1 min-w-0',
        present ? 'relative z-1' : 'pointer-events-none',
      )}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        transition: { duration: 0.2, delay: enterDelay / 1000, ease: EASE_OUT_QUART },
      }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
    >
      {children}
    </motion.div>
  )
}
