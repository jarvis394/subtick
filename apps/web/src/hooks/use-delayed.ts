import { useEffect, useState } from 'react'

/**
 * True once `active` has stayed true for `ms`, false again as soon as it isn't. For placeholders
 * that would only flash on a fast load.
 */
export const useDelayed = (active: boolean, ms: number) => {
  const [elapsed, setElapsed] = useState(false)
  if (!active && elapsed) setElapsed(false)

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- timer that flips once `active` has held for `ms`
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setElapsed(true), ms)

    return () => clearTimeout(timer)
  }, [active, ms])

  return active && elapsed
}
