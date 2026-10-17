/** Who may do what: `admin`s manage recorders, their Steam accounts and other users' roles. */
export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** What a recorder machine last reported doing. */
export const RECORDER_STATES = [
  /** Booting: preparing the prefix and connecting to subtick. */
  'starting',
  /** Waiting for jobs. */
  'idle',
  /** Signing its Steam client in (or switching accounts). */
  'signing_in',
  /** Steam emailed a Steam Guard code; an admin has to enter it. */
  'needs_guard_code',
  'recording',
  /** The last sign-in or game start failed; see `lastError`. Retried on the next job. */
  'error',
] as const
export type RecorderState = (typeof RECORDER_STATES)[number]

/**
 * How a recorder's CS2 gets Steam: the Windows Steam client signed in to an account, or gbe_fork
 * emulating it (no client, no account, no Steam Guard).
 */
export const STEAM_MODES = ['client', 'emulator'] as const
export type SteamMode = (typeof STEAM_MODES)[number]

/** Recorders report every 15 s, faster while an admin is typing in a Steam Guard code. */
export const RECORDER_HEARTBEAT_MS = 15_000
export const RECORDER_HEARTBEAT_FAST_MS = 3000
/** A recorder that hasn't reported for this long is shown offline. */
export const RECORDER_OFFLINE_AFTER_MS = 3 * RECORDER_HEARTBEAT_MS

export const isRecorderOnline = (lastSeenAt: Date | string | null, now = Date.now()) =>
  lastSeenAt !== null && now - new Date(lastSeenAt).getTime() < RECORDER_OFFLINE_AFTER_MS

/** Tokens are shown once; the prefix makes them recognisable in config files and secret scanners. */
export const RECORDER_TOKEN_PREFIX = 'strec_'
