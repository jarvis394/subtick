/**
 * Dev only: analyzes a local demo and stores it as if the pipeline had run, linked to every
 * subtick user (as the top-rated player), so the web app has real data without Steam/GC.
 *   bun run seed test/fixtures/<matchId>_<x>.dem
 */
import { basename } from 'node:path'
import { DatabaseEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import { PARSER_VERSION, analyzeDemo, readDemoFile } from '../src/analyze'
import { persistAnalysis } from '../src/persist'

const path = process.argv[2]
if (!path) throw new Error('usage: bun scripts/seed.ts <demo.dem>')

const matchId = BigInt(basename(path).split('_')[0]!).toString()
const db = createDb(loadEnv(DatabaseEnv).DATABASE_URL)
const analysis = analyzeDemo(await readDemoFile(path))

await db.insert(schema.match).values({ id: matchId }).onConflictDoNothing()
await persistAnalysis(db, matchId, analysis, PARSER_VERSION)

await db
  .update(schema.match)
  .set({ status: 'ready', playedAt: new Date(Date.now() - Math.random() * 3 * 24 * 3600 * 1000) })
  .where(eq(schema.match.id, matchId))

const [best] = [...analysis.stats].toSorted((a, b) => b[1].rating - a[1].rating)
const users = await db.select({ id: schema.user.id }).from(schema.user)

if (users.length) {
  await db
    .insert(schema.userMatch)
    .values(users.map((user) => ({ userId: user.id, matchId, steamId: best![0] })))
    .onConflictDoNothing()
}

console.log(
  `seeded ${analysis.timeline.header.map} as ${matchId} for ${users.length} user(s), ${analysis.highlights.length} highlights`,
)

process.exit(0)
