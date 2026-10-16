import { STEAM_SYNC_STATES } from '@subtick/domain'
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const syncState = pgEnum('sync_state', STEAM_SYNC_STATES)

/** A Steam account linked to a subtick user, plus what we need to poll its match history. */
export const steamLink = pgTable(
  'steam_link',
  {
    steamId: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    personaName: text().notNull(),
    avatarUrl: text(),
    /** Match history auth code (XXXX-XXXXX-XXXX), encrypted at rest by the api. */
    authCode: text(),
    lastShareCode: text(),
    syncState: syncState().notNull().default('idle'),
    lastError: text(),
    nextSyncAt: timestamp(),
    lastSyncedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index().on(t.userId), index().on(t.nextSyncAt)],
)

/**
 * Public Steam profile of any player seen in a match (not only subtick users), for names and
 * avatars. Filled lazily by the api and refreshed when stale.
 */
export const steamProfile = pgTable('steam_profile', {
  steamId: text().primaryKey(),
  personaName: text().notNull(),
  avatarUrl: text(),
  fetchedAt: timestamp().notNull().defaultNow(),
})
