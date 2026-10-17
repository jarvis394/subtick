import type { Me } from '@/lib/queries'

/**
 * The last `/me` response, kept in localStorage as the "signed in" hint. The session cookie is
 * httpOnly, so scripts can't see it; this lets a reload render the app shell at once while `/me`
 * revalidates in the background. A 401 clears it (and signs out), so a stale hint never outlives
 * the session. Storage can be unavailable (private mode), so every access is guarded.
 */
const KEY = 'subtick:me'

export const readStoredMe = (): Me | undefined => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Me) : undefined
  } catch {
    return undefined
  }
}

export const writeStoredMe = (me: Me) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(me))
  } catch {
    // Not persisted; the next reload waits for /me as before.
  }
}

export const clearStoredMe = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}
