import {
  MATCH_MODES,
  MATCH_STATUSES,
  type PlayerRank,
  type PlayerStats,
  SIDES,
  type Side,
} from '@subtick/domain'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { jsonb } from '../jsonb'
import { user } from './auth'

export const matchStatus = pgEnum('match_status', MATCH_STATUSES)
export const side = pgEnum('side', SIDES)
export const matchMode = pgEnum('match_mode', MATCH_MODES)

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
    mode: matchMode(),
    serverName: text(),
    tickrate: smallint(),
    durationTicks: integer(),
    roundsPlayed: smallint(),
    /** Final score, keyed by the side each team *started* on. */
    scoreStartedCt: smallint(),
    scoreStartedT: smallint(),
    /**
     * steamId64 → party id, written by the steam worker when it resolves the match: from the Game
     * Coordinator's reservation (`party_ids`) when it has them, which CS2's GC so far never has,
     * otherwise from Steam friendships between the players. Demos don't record parties.
     */
    parties: jsonb().$type<Record<string, string>>(),
    demoKey: text(),
    demoExpiresAt: timestamp({ withTimezone: true }),
    parserVersion: smallint(),
    playedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
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
    /** Rating/skill group before and after this match, from the demo's rank updates. */
    rank: jsonb().$type<PlayerRank>(),
    /** Same id = queued together. Copied from `match.parties` on every parse. */
    partyId: text(),
    /** The player's crosshair share code (`CS…`) at their last round of this match. */
    crosshair: text(),
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
    discoveredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
    /** Winning team by the side it started on, so halves and swaps need no side rules. */
    winnerTeam: side(),
    reason: text().notNull(),
    startTick: integer().notNull(),
    freezeEndTick: integer().notNull(),
    endTick: integer().notNull(),
    ctEquipValue: integer().notNull(),
    tEquipValue: integer().notNull(),
    /** Bomb plant, defuse and explosion; null when it didn't happen this round. */
    bombPlantTick: integer(),
    bombPlanterSteamId: text(),
    bombDefuseTick: integer(),
    bombDefuserSteamId: text(),
    bombExplodeTick: integer(),
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
