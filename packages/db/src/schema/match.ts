import { MATCH_STATUSES, type PlayerStats, SIDES, type Side } from '@subtick/domain'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const matchStatus = pgEnum('match_status', MATCH_STATUSES)
export const side = pgEnum('side', SIDES)

/**
 * One row per CS2 match, shared by everyone who played in it. The id is Valve's 64-bit match id
 * in decimal (kept as text so it survives JSON untouched).
 */
export const match = pgTable(
  'match',
  {
    id: text().primaryKey(),
    shareCode: text().unique(),
    demoUrl: text(),
    status: matchStatus().notNull().default('queued'),
    error: text(),
    map: text(),
    serverName: text(),
    tickrate: smallint(),
    durationTicks: integer(),
    roundsPlayed: smallint(),
    /** Final score, keyed by the side each team *started* on. */
    scoreStartedCt: smallint(),
    scoreStartedT: smallint(),
    demoKey: text(),
    demoExpiresAt: timestamp(),
    parserVersion: smallint(),
    playedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.status)],
)

export const matchPlayer = pgTable(
  'match_player',
  {
    matchId: text()
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    steamId: text().notNull(),
    name: text().notNull(),
    startingSide: side().notNull(),
    stats: jsonb().$type<PlayerStats>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.steamId] }), index().on(t.steamId)],
)

/** Links subtick users to matches they played. Many users → one match → one demo. */
export const userMatch = pgTable(
  'user_match',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    matchId: text()
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    steamId: text().notNull(),
    discoveredAt: timestamp().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.matchId] }), index().on(t.matchId)],
)

export const round = pgTable(
  'round',
  {
    matchId: text()
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    number: smallint().notNull(),
    winner: side().notNull(),
    reason: text().notNull(),
    startTick: integer().notNull(),
    freezeEndTick: integer().notNull(),
    endTick: integer().notNull(),
    ctEquipValue: integer().notNull(),
    tEquipValue: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.number] })],
)

export const kill = pgTable(
  'kill',
  {
    id: serial().primaryKey(),
    matchId: text()
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    round: smallint().notNull(),
    tick: integer().notNull(),
    attackerSteamId: text(),
    victimSteamId: text().notNull(),
    assisterSteamId: text(),
    weapon: text().notNull(),
    tags: text().array().notNull().default([]),
    distance: real(),
  },
  (t) => [index().on(t.matchId, t.round)],
)

export type Match = typeof match.$inferSelect
export type MatchPlayer = typeof matchPlayer.$inferSelect
export type Round = typeof round.$inferSelect
export type Kill = typeof kill.$inferSelect
export type { Side }
