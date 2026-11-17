import { CANCELLED_ERROR, type MatchStatus } from '@subtick/domain'
import { SQL } from 'bun'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

export const createDb = (url: string) =>
  drizzle({ client: new SQL(url), schema, casing: 'snake_case' })

export type Db = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Guards a worker's status write: a match someone cancelled stays cancelled, even when a job that
 * was already running finishes a step afterwards.
 */
export const notCancelled = sql`not (${schema.match.status} = 'failed' and ${schema.match.error} is not distinct from ${CANCELLED_ERROR})`

/** Moves a match to a pipeline status and tells subscribed browsers, unless it was cancelled. */
export const setMatchStatus = async (
  db: Db,
  publish: (event: { matchId: string; status: MatchStatus }) => Promise<unknown>,
  matchId: string,
  status: MatchStatus,
  error: string | null = null,
) => {
  const updated = await db
    .update(schema.match)
    .set({ status, error })
    .where(and(eq(schema.match.id, matchId), notCancelled))
    .returning({ id: schema.match.id })
  if (updated.length) await publish({ matchId, status })
}

export { schema }
export * from './secrets'
export * from 'drizzle-orm'
