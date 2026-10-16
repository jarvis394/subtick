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
 * Steam accounts that recorders' game clients sign in with. One account plays on one machine at a
 * time, so each is assigned to at most one recorder. Secrets are encrypted at rest by the api.
 */
export const recorderSteamAccount = pgTable('recorder_steam_account', {
  id: uuid().primaryKey().defaultRandom(),
  username: text().notNull().unique(),
  password: text().notNull(),
  /** Steam Guard mobile authenticator secret; without it Steam emails a code on new sign-ins. */
  sharedSecret: text(),
  note: text(),
  createdAt: at().notNull().defaultNow(),
  updatedAt: at()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * A machine that records clips, registered by an admin (like a CI runner). It authenticates with a
 * token shown once at creation, reports its health in heartbeats and is told which account to use.
 */
export const recorder = pgTable('recorder', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** sha256 of the token, hex. */
  tokenHash: text().notNull().unique(),
  /** The token's first characters, to tell tokens apart in the UI. */
  tokenHint: text().notNull(),
  steamAccountId: uuid()
    .unique()
    .references(() => recorderSteamAccount.id, { onDelete: 'set null' }),
  /** A paused recorder finishes its current job and takes no new ones. */
  paused: boolean().notNull().default(false),
  /** Emailed Steam Guard code an admin entered, encrypted; handed over once on the next heartbeat. */
  guardCode: text(),

  // Last heartbeat. All null until the machine first connects.
  state: recorderState(),
  signedInAs: text(),
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
