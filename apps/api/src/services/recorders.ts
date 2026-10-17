import { RECORDER_TOKEN_PREFIX, isRecorderOnline } from '@subtick/domain'
import type { schema } from '@subtick/db'

const TOKEN_HINT_LENGTH = RECORDER_TOKEN_PREFIX.length + 6

/** A new recorder token and what's stored of it (the hash, and a hint to recognise it by). */
export const newRecorderToken = () => {
  const token = `${RECORDER_TOKEN_PREFIX}${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`
  return {
    token,
    tokenHash: hashRecorderToken(token),
    tokenHint: token.slice(0, TOKEN_HINT_LENGTH),
  }
}

export const hashRecorderToken = (token: string) =>
  new Bun.CryptoHasher('sha256').update(token).digest('hex')

type RecorderRow = typeof schema.recorder.$inferSelect

/** A recorder as admins see it: never the token, plus whether it's online. */
export const recorderView = (row: RecorderRow) => ({
  id: row.id,
  name: row.name,
  tokenHint: row.tokenHint,
  paused: row.paused,
  online: isRecorderOnline(row.lastSeenAt),
  state: row.state,
  currentMatchId: row.currentMatchId,
  lastError: row.lastError,
  hostname: row.hostname,
  gpu: row.gpu,
  version: row.version,
  clipsRecorded: row.clipsRecorded,
  startedAt: row.startedAt,
  lastSeenAt: row.lastSeenAt,
  createdAt: row.createdAt,
})
