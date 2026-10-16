/**
 * Makes an existing user an admin. Admins can then grant the role to others from the web app.
 *
 *   bun run grant-admin <email | steamId64>
 */
import { createDb, eq, or, schema } from '@subtick/db'
import { env } from '../src/env'

const [who] = process.argv.slice(2)
if (!who) {
  console.error('usage: bun run grant-admin <email | steamId64>')
  process.exit(1)
}

const db = createDb(env.DATABASE_URL)
const [link] = await db
  .select({ userId: schema.steamLink.userId })
  .from(schema.steamLink)
  .where(eq(schema.steamLink.steamId, who))
const [user] = await db
  .update(schema.user)
  .set({ role: 'admin' })
  .where(or(eq(schema.user.email, who), link ? eq(schema.user.id, link.userId) : undefined))
  .returning({ name: schema.user.name, email: schema.user.email })

if (!user) {
  console.error(`no user with email or linked Steam ID ${who}`)
  process.exit(1)
}
console.log(`${user.name} (${user.email}) is now an admin`)
process.exit(0)
