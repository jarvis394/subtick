import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { EASE_OUT_QUART } from '@/lib/motion'
import { useIsNew } from '@/lib/new-matches'
import { cn } from '@/lib/utils'

/**
 * Marks a match that just turned up; shrinks away once the user has opened it. `hidden` fades it
 * out while keeping its place (the sidebar's rail shows its own dot on the map icon instead).
 */
export const NewDot = ({
  matchId,
  hidden = false,
  className,
}: {
  matchId: string
  hidden?: boolean
  className?: string
}) => {
  const isNew = useIsNew(matchId)
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {isNew && (
        <motion.span
          aria-hidden
          className={cn('ml-1.5 size-1.5 shrink-0 rounded-full bg-link', className)}
          initial={false}
          animate={{ opacity: hidden ? 0 : 1, transition: { duration: 0.15, ease: 'easeOut' } }}
          exit={{ width: 0, marginLeft: 0, opacity: 0, scale: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE_OUT_QUART }}
        />
      )}
    </AnimatePresence>
  )
}
