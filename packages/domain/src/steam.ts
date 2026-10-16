/** Match-history polling state of a linked Steam account. */
export const STEAM_SYNC_STATES = ['idle', 'syncing', 'needs_auth', 'error'] as const
export type SteamSyncState = (typeof STEAM_SYNC_STATES)[number]
