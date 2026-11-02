import { AnimatePresence, animate, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { type Ref, useRef, useState } from 'react'
import { EASE_OUT_STRONG } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * A label that crossfades when its text changes (Add email ↔ Cancel) while the width eases to the new text's.
 * Nothing clips: the new text lays out at full width from the first frame, and the old one leaves the flow.
 */
export const MorphLabel = ({
  children,
  align = 'center',
}: {
  children: string
  /** `start` for left-aligned labels (menu items); buttons center theirs. */
  align?: 'center' | 'start'
}) => {
  const box = useRef<HTMLSpanElement>(null)
  const measured = useRef(false)
  const reduce = useReducedMotion()
  // Each change is a new element, never an exiting one brought back: flipping A -> B -> A faster
  // than the exit leaves AnimatePresence holding the old A mid-exit, and the label sticks.
  const [shown, setShown] = useState({ text: children, id: 0 })
  if (shown.text !== children) setShown({ text: children, id: shown.id + 1 })

  // Each change mounts a new incoming text, so its ref measures it. The first width is set
  // outright, so the first change has a width to ease from; later ones ease (taking over any
  // still running).
  const measure = (incoming: HTMLSpanElement | null) => {
    if (!box.current || !incoming) return
    const next = incoming.offsetWidth
    if (!measured.current) {
      measured.current = true
      box.current.style.width = `${next}px`
    } else {
      animate(
        box.current,
        { width: next },
        reduce ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT_STRONG },
      )
    }
  }

  return (
    <span
      ref={box}
      className={cn(
        'relative inline-flex whitespace-nowrap',
        align === 'center' ? 'justify-center' : 'justify-start',
      )}
    >
      <AnimatePresence initial={false}>
        <Text key={shown.id} ref={measure} align={align} reduce={!!reduce}>
          {shown.text}
        </Text>
      </AnimatePresence>
    </span>
  )
}

const Text = ({
  ref,
  align,
  reduce,
  children,
}: {
  ref: Ref<HTMLSpanElement>
  align: 'center' | 'start'
  reduce: boolean
  children: string
}) => {
  const present = useIsPresent()

  return (
    <motion.span
      ref={present ? ref : undefined}
      aria-hidden={!present || undefined}
      className={cn(
        present
          ? 'shrink-0'
          : cn(
              'pointer-events-none absolute top-0',
              align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
            ),
      )}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: 1,
        scale: 1,
        // The incoming text waits a beat, so it isn't muddled with the outgoing one at full strength.
        transition: reduce
          ? { duration: 0 }
          : { duration: 0.22, delay: 0.04, ease: EASE_OUT_STRONG },
      }}
      exit={{
        opacity: 0,
        scale: 0.96,
        transition: { duration: reduce ? 0 : 0.12, ease: 'easeOut' },
      }}
    >
      {children}
    </motion.span>
  )
}
