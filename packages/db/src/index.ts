import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

export const createDb = (url: string) =>
  drizzle({ client: new SQL(url), schema, casing: 'snake_case' })

export type Db = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export { schema }
export * from './secrets'
export * from 'drizzle-orm'
