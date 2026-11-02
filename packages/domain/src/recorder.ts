/** Who may do what: `admin`s manage recorders and other users' roles. */
export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** What a recorder machine last reported doing. */
export const RECORDER_STATES = [
  /** Booting: preparing the prefix and connecting to subtick. */
  'starting',
  /** Waiting for jobs. */
  'idle',
  'recording',
] as const

export type RecorderState = (typeof RECORDER_STATES)[number]

/** Recorders report every 15 s. */
export const RECORDER_HEARTBEAT_MS = 15_000
/** A recorder that hasn't reported for this long is shown offline. */
export const RECORDER_OFFLINE_AFTER_MS = 3 * RECORDER_HEARTBEAT_MS

export const isRecorderOnline = (lastSeenAt: Date | string | null, now = Date.now()) =>
  lastSeenAt !== null && now - new Date(lastSeenAt).getTime() < RECORDER_OFFLINE_AFTER_MS

/** Tokens are shown once; the prefix makes them recognisable in config files and secret scanners. */
export const RECORDER_TOKEN_PREFIX = 'strec_'
