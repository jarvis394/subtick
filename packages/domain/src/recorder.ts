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

/** Clips a recorder fails in a row before it counts as failing; a recorded clip resets it. */
export const RECORDER_FAILING_AFTER = 3

export type RecorderHealth = 'healthy' | 'failing' | 'paused' | 'offline'

export const recorderHealth = (
  row: { lastSeenAt: Date | string | null; paused: boolean; failStreak: number },
  now = Date.now(),
): RecorderHealth =>
  !isRecorderOnline(row.lastSeenAt, now)
    ? 'offline'
    : row.paused
      ? 'paused'
      : row.failStreak >= RECORDER_FAILING_AFTER
        ? 'failing'
        : 'healthy'

/**
 * An HLAE release and the mirv_pov fork build made on it, as the recorder's bootstrap installs
 * them. Names only: the bootstrap builds the GitHub URLs itself.
 */
export interface HlaeBuild {
  hlae: string
  povRelease: string
  povAsset: string
  /** sha256 of the fork's zip, hex. */
  povSha256: string
}

export const HLAE_BUILD_PATTERNS = {
  hlae: /^\d+\.\d+\.\d+$/,
  povRelease: /^[\w.-]{1,120}$/,
  povAsset: /^[\w.-]{1,120}\.zip$/,
  povSha256: /^[0-9a-f]{64}$/,
} satisfies Record<keyof HlaeBuild, RegExp>
