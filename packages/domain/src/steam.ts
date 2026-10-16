/** Match-history polling state of a linked Steam account. */
export const STEAM_SYNC_STATES = ['idle', 'syncing', 'needs_auth', 'error'] as const
export type SteamSyncState = (typeof STEAM_SYNC_STATES)[number]

const STEAM_ID_RE = /^7656119\d{10}$/
/** Game authentication code from Steam Help → "Access to Your Match History". */
const MATCH_AUTH_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/

export const isSteamId = (value: string) => STEAM_ID_RE.test(value)
export const isMatchAuthCode = (value: string) => MATCH_AUTH_CODE_RE.test(value)

/** SteamID64 of the individual account with 32-bit account id 0; the GC speaks account ids. */
const STEAM_ID64_BASE = 76561197960265728n

export const accountIdToSteamId = (accountId: number) =>
  (STEAM_ID64_BASE + BigInt(accountId)).toString()

/**
 * Valve names demos `<id, 21 digits>_<n>.dem.bz2`. The id is *not* the share code's match id, so
 * it only identifies a match that is imported by URL alone (dev fixtures).
 */
const DEMO_URL_RE = /\/(\d{19,21})_\d+\.dem(\.bz2)?$/

export const demoIdFromUrl = (url: string) => {
  const digits = DEMO_URL_RE.exec(new URL(url).pathname)?.[1]
  return digits ? BigInt(digits).toString() : null
}
