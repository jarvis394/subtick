import {
  HIGHLIGHT_KINDS,
  HIGHLIGHT_STATUSES,
  type HighlightClutch,
  type HighlightKill,
  type MomentTag,
} from '@subtick/domain'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { match } from './match'

export const highlightKind = pgEnum('highlight_kind', HIGHLIGHT_KINDS)
export const highlightStatus = pgEnum('highlight_status', HIGHLIGHT_STATUSES)

/** A detected moment for one player. Recorded into a `clip` on demand or right away. */
export const highlight = pgTable(
  'highlight',
  {
    id: uuid().primaryKey().defaultRandom(),
    matchId: text()
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    steamId: text().notNull(),
    round: smallint().notNull(),
    kind: highlightKind().notNull(),
    title: text().notNull(),
    score: real().notNull(),
    startTick: integer().notNull(),
    endTick: integer().notNull(),
    kills: jsonb().$type<HighlightKill[]>().notNull(),
    tags: text().array().$type<MomentTag[]>().notNull().default([]),
    clutch: jsonb().$type<HighlightClutch>(),
    status: highlightStatus().notNull().default('candidate'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.matchId, t.steamId), index().on(t.steamId, t.score)],
)

export const clip = pgTable('clip', {
  highlightId: uuid()
    .primaryKey()
    .references(() => highlight.id, { onDelete: 'cascade' }),
  videoKey: text().notNull(),
  thumbnailKey: text().notNull(),
  durationMs: integer().notNull(),
  width: smallint().notNull(),
  height: smallint().notNull(),
  recorderVersion: smallint().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type Highlight = typeof highlight.$inferSelect
export type NewHighlight = typeof highlight.$inferInsert
export type Clip = typeof clip.$inferSelect
