import { useSyncExternalStore } from 'react'

/**
 * Matches new to this browser: discovered (server time) after the newest one it had seen, and not opened
 * since. Kept in localStorage so the dot survives reloads; the first list load only sets the baseline.
 * Storage can be unavailable (private mode), so every access is guarded.
 */
const KEY = 'subtick:new-matches'

type Stored = { baseline: number; unseen: string[] }

const read = (): Stored | null => {
  try {
    const raw = localStorage.getItem(KEY)

    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

const stored = read()
let baseline = stored?.baseline ?? null
const unseen = new Set(stored?.unseen)
/** When matches turned up during this visit (`performance.now()`), so their rows can grow in. */
const arrived = new Map<string, number>()
let observed = false

const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

const commit = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ baseline, unseen: [...unseen] }))
  } catch {
    // Not persisted; it lasts for this page.
  }
  listeners.forEach((listener) => listener())
}

export const observeMatches = (items: { id: string; discoveredAt: string | Date }[]) => {
  const times = items.map((m) => new Date(m.discoveredAt).getTime())
  const newest = Math.max(0, ...times)
  const firstThisVisit = !observed
  observed = true
  if (baseline === null) {
    baseline = newest

    return commit()
  }
  const fresh = items.filter((m, i) => times[i]! > baseline! && !unseen.has(m.id))
  if (!fresh.length) return
  for (const m of fresh) {
    unseen.add(m.id)
    // What the first load brings in was there before the page; only later arrivals grow in.
    if (!firstThisVisit) arrived.set(m.id, performance.now())
  }
  // Advanced past them, so one that's been opened doesn't come back as new.
  baseline = Math.max(baseline, newest)
  commit()
}

/** The user opened the match, so it's no longer new. */
export const markSeen = (id: string) => {
  if (unseen.delete(id)) commit()
}

/** Whether the match turned up since this browser last looked and hasn't been opened since. */
export const useIsNew = (id: string) => useSyncExternalStore(subscribe, () => unseen.has(id))

/** Whether the match only just turned up, so its row should animate in. */
export const justFound = (id: string) => {
  const at = arrived.get(id)

  return at !== undefined && performance.now() - at < 1500
}
