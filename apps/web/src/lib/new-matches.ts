import { focusedNow } from '@/lib/focus-clock'

/**
 * Which matches turned up while the app was open. The first list load sets the baseline (the
 * newest discovery it saw, in server time, so client clocks don't matter); any match discovered
 * after it is new from the moment a list first brings it in.
 */
let baseline: number | null = null
const found = new Map<string, { stamp: number; at: number }>()

/** How long a new match keeps its dot, in focused time. */
export const NEW_MS = 5000

export const observeMatches = (items: { id: string; discoveredAt: string | Date }[]) => {
  const times = items.map((m) => new Date(m.discoveredAt).getTime())
  if (baseline === null) {
    baseline = Math.max(0, ...times)
    return
  }
  items.forEach((m, i) => {
    if (times[i]! > baseline! && !found.has(m.id)) {
      found.set(m.id, { stamp: focusedNow(), at: performance.now() })
    }
  })
}

/** The focused-clock reading from when the match turned up, if it is new. */
export const newMatchStamp = (id: string) => found.get(id)?.stamp

/** Whether the match only just turned up, so its row should animate in. */
export const justFound = (id: string) => {
  const entry = found.get(id)
  return entry !== undefined && performance.now() - entry.at < 1500
}
