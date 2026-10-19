import { useEffect, useState } from 'react'

/**
 * True once `active` has stayed true for `ms`, false again as soon as it isn't. For placeholders
 * that would only flash on a fast load.
 */
export const useDelayed = (active: boolean, ms: number) => {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return setElapsed(false)
    const timer = setTimeout(() => setElapsed(true), ms)
    return () => clearTimeout(timer)
  }, [active, ms])
  return active && elapsed
}
