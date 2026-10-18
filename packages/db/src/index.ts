import { CANCELLED_ERROR } from '@subtick/domain'
import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
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

export { schema }
export * from './secrets'
export * from 'drizzle-orm'
