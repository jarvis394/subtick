import { RECORDER_STATES } from '@subtick/domain'
import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * With time zone: drizzle on Bun SQL reads plain `timestamp` columns as local time in joined
 * selects, which would put heartbeats hours off.
 */
const at = () => timestamp({ withTimezone: true })

export const recorderState = pgEnum('recorder_state', RECORDER_STATES)

/**
 * A machine that records clips, registered by an admin (like a CI runner). It authenticates with a
 * token shown once at creation, reports its health in heartbeats and is told whether it's paused.
 */
export const recorder = pgTable('recorder', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** sha256 of the token, hex. */
  tokenHash: text().notNull().unique(),
  /** The token's first characters, to tell tokens apart in the UI. */
  tokenHint: text().notNull(),
  /** A paused recorder finishes its current job and takes no new ones. */
  paused: boolean().notNull().default(false),

  // Last heartbeat. All null until the machine first connects.
  state: recorderState(),
  currentMatchId: text(),
  lastError: text(),
  hostname: text(),
  gpu: text(),
  version: text(),
  clipsRecorded: integer().notNull().default(0),
  startedAt: at(),
  lastSeenAt: at(),

  createdBy: text().references(() => user.id, { onDelete: 'set null' }),
  createdAt: at().notNull().defaultNow(),
})
