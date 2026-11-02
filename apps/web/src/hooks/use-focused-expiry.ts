import { useEffect, useReducer } from 'react'
import { focusedNow, isClockRunning, onClockChange } from '@/lib/focus-clock'

/**
 * True until `ms` of focused time (see focus-clock) has passed since `stamp`, a `focusedNow()`
 * reading. Rerenders when that runs out; false with no stamp.
 */
export const useFocusedExpiry = (stamp: number | undefined, ms: number) => {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const live = stamp !== undefined && focusedNow() < stamp + ms

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- timer on the focus clock that rerenders when the time runs out
  useEffect(() => {
    if (!live) return
    let timer: ReturnType<typeof setTimeout> | undefined

    // Only counts down while the clock runs; stopping it holds the remaining time.
    const schedule = () => {
      clearTimeout(timer)
      if (isClockRunning()) timer = setTimeout(rerender, stamp + ms - focusedNow() + 16)
    }

    schedule()
    const unsubscribe = onClockChange(schedule)

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [live, stamp, ms])

  return live
}
