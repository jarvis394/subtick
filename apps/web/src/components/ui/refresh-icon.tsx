import { RotateCw } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** One turn while spinning; the last turn after a stop eases out over about as long. */
const TURN_MS = 700

/**
 * The refresh arrow, turning while `spinning`. It eases into the first turn, and when spinning
 * stops it carries on to the end of the turn it's on and settles there, instead of snapping back.
 */
export const RefreshIcon = ({ spinning, className }: { spinning: boolean; className?: string }) => {
  const icon = useRef<SVGSVGElement>(null)
  const spin = useRef<Animation | null>(null)

  useEffect(() => {
    const el = icon.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (spinning) {
      // One eased turn to get going, then steady turns from there.
      const start = el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], {
        duration: TURN_MS * 1.3,
        easing: 'cubic-bezier(0.5, 0, 0.75, 1)',
      })
      spin.current = start
      start.onfinish = () => {
        spin.current = el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], {
          duration: TURN_MS,
          iterations: Infinity,
        })
      }
      return
    }
    const running = spin.current
    if (!running) return
    spin.current = null
    // Finish the turn from wherever it got to.
    const angle = Number.parseFloat(getComputedStyle(el).rotate) || 0
    running.onfinish = null
    running.cancel()
    el.animate([{ rotate: `${angle}deg` }, { rotate: '360deg' }], {
      duration: TURN_MS * (0.6 + ((360 - angle) / 360) * 0.6),
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    })
  }, [spinning])

  return <RotateCw ref={icon} className={className} />
}
