/** Applies pending migrations from ./drizzle (drizzle-kit's migrate needs a node driver; we use bun:sql). */
import { DatabaseEnv, loadEnv } from '@subtick/config'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { createDb } from './index'

const db = createDb(loadEnv(DatabaseEnv).DATABASE_URL)
await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
console.log('migrations applied')
process.exit(0)
