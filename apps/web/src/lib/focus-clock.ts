/**
 * A clock that only runs while someone is looking: the tab is visible and the window has focus.
 * Things shown "for a few seconds" (a refresh's result, the dot on a new match) count this time,
 * so they are still there when the user comes back to the page.
 */
const isFocused = () => document.visibilityState === 'visible' && document.hasFocus()

let banked = 0
let since: number | null = isFocused() ? performance.now() : null
const listeners = new Set<() => void>()

const update = () => {
  const focused = isFocused()
  if (focused && since === null) since = performance.now()
  if (!focused && since !== null) {
    banked += performance.now() - since
    since = null
  }
  for (const listener of listeners) listener()
}
window.addEventListener('focus', update)
window.addEventListener('blur', update)
document.addEventListener('visibilitychange', update)

/** Milliseconds of focused time since the app loaded. */
export const focusedNow = () => banked + (since === null ? 0 : performance.now() - since)

export const isClockRunning = () => since !== null

/** Calls `listener` whenever the clock starts or stops. */
export const onClockChange = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
