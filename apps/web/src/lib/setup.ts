import type { Me } from '@/lib/queries'

const SKIPPED_KEY = 'subtick:setup-skipped'
// Keeps the skip for this tab when storage isn't available.
let skippedHere = false

/** Setup is done once a linked Steam account has given access to its match history. */
export const isSetUp = (me: Me) => me.steamLinks.some((link) => link.hasMatchAuth)

/** Whether this browser chose to skip setup for now. Storage can be unavailable (private mode). */
export const setupSkipped = () => {
  if (skippedHere) return true
  try {
    return localStorage.getItem(SKIPPED_KEY) === 'true'
  } catch {
    return false
  }
}

export const skipSetup = () => {
  skippedHere = true
  try {
    localStorage.setItem(SKIPPED_KEY, 'true')
  } catch {
    // Not persisted; after a reload setup shows again.
  }
}
