import { RotateCw } from 'lucide-react'
import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import { useEffect } from 'react'
import { EASE_OUT_QUART } from '@/lib/motion'

/** One turn while spinning; the last turn after a stop eases out over about as long. */
const TURN_S = 0.7

const MotionRotateCw = motion.create(RotateCw)

/**
 * The refresh arrow, turning while `spinning`. It eases into the first turn, and when spinning
 * stops it carries on to the end of the turn it's on and settles there, instead of snapping back.
 */
export const RefreshIcon = ({ spinning, className }: { spinning: boolean; className?: string }) => {
  const rotate = useMotionValue(0)
  const reduce = useReducedMotion()

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- drives the motion value's spin animation with `spinning`
  useEffect(() => {
    if (reduce) return
    if (spinning) {
      let cancelled = false
      let loop: AnimationPlaybackControls | undefined
      // One eased turn to get going, then steady turns from there.
      const start = animate(rotate, [0, 360], { duration: TURN_S * 1.3, ease: [0.5, 0, 0.75, 1] })

      const keepTurning = async () => {
        await start
        if (!cancelled)
          loop = animate(rotate, [0, 360], { duration: TURN_S, ease: 'linear', repeat: Infinity })
      }

      void keepTurning()

      return () => {
        cancelled = true
        start.stop()
        loop?.stop()
      }
    }
    // Finish the turn from wherever it got to.
    const angle = rotate.get() % 360
    if (angle === 0) return
    const finish = animate(rotate, [angle, 360], {
      duration: TURN_S * (0.6 + ((360 - angle) / 360) * 0.6),
      ease: EASE_OUT_QUART,
    })

    return () => finish.stop()
  }, [spinning, reduce, rotate])

  return <MotionRotateCw style={{ rotate }} className={className} />
}
