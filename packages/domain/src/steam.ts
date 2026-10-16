/** Match-history polling state of a linked Steam account. */
export const STEAM_SYNC_STATES = ['idle', 'syncing', 'needs_auth', 'error'] as const
export type SteamSyncState = (typeof STEAM_SYNC_STATES)[number]

const STEAM_ID_RE = /^7656119\d{10}$/
/** Game authentication code from Steam Help → "Access to Your Match History". */
const MATCH_AUTH_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/

export const isSteamId = (value: string) => STEAM_ID_RE.test(value)
export const isMatchAuthCode = (value: string) => MATCH_AUTH_CODE_RE.test(value)
