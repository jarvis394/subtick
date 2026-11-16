/* oxlint-disable no-await-in-loop -- a few demos, one at a time */
/**
 * Dev only: analyzes local demos and stores them as if the pipeline had run, linked to every
 * subtick user (as the top-rated player), so the web app has real data without Steam/GC. Without
 * arguments, seeds every demo in test/fixtures (`bun run fixtures` downloads them).
 *   bun run seed [test/fixtures/<matchId>_<x>.dem ...]
 */
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { DatabaseEnv, loadEnv } from '@subtick/config'
import { createDb, eq, schema } from '@subtick/db'
import { PARSER_VERSION, analyzeDemo, readDemoFile } from '../src/analyze'
import { persistAnalysis } from '../src/persist'
import { FIXTURE_DIR } from '../test/fixtures'

const fixtures = async () =>
  (await readdir(FIXTURE_DIR).catch(() => []))
    .filter((name) => name.endsWith('.dem'))
    .map((name) => join(FIXTURE_DIR, name))

const paths = process.argv.length > 2 ? process.argv.slice(2) : await fixtures()

if (!paths.length) {
  console.error('No demos to seed: run `bun run fixtures` first, or pass paths to .dem files.')
  process.exit(1)
}

const db = createDb(loadEnv(DatabaseEnv).DATABASE_URL)
const users = await db.select({ id: schema.user.id }).from(schema.user)

for (const path of paths) {
  const matchId = BigInt(basename(path).split('_')[0]!).toString()
  const analysis = analyzeDemo(await readDemoFile(path))

  await db.insert(schema.match).values({ id: matchId }).onConflictDoNothing()
  await persistAnalysis(db, matchId, analysis, PARSER_VERSION)

  await db
    .update(schema.match)
    .set({ status: 'ready', playedAt: new Date(Date.now() - Math.random() * 3 * 24 * 3600 * 1000) })
    .where(eq(schema.match.id, matchId))

  const [best] = [...analysis.stats].toSorted((a, b) => b[1].rating - a[1].rating)

  if (users.length) {
    await db
      .insert(schema.userMatch)
      .values(users.map((user) => ({ userId: user.id, matchId, steamId: best![0] })))
      .onConflictDoNothing()
  }

  console.log(
    `seeded ${analysis.timeline.header.map} as ${matchId} for ${users.length} user(s), ${analysis.highlights.length} highlights`,
  )
}

if (!users.length) console.log('No users yet: sign up in the web app, then seed again.')

process.exit(0)
