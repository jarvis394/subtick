/**
 * Stores crosshair codes for matches parsed before they were read. Only touches
 * `match_player.crosshair`: a full re-parse would rewrite highlights, and their recorded clips
 * with them.
 *   bun run backfill-crosshairs
 */
import { DatabaseEnv, S3Env, loadEnv } from '@subtick/config'
import { and, createDb, eq, isNotNull, isNull, schema } from '@subtick/db'
import { createS3Storage, keys } from '@subtick/storage'
import { latestCrosshairs } from '../src/analyze'
import { openDemo } from '../src/demo'

const env = loadEnv({ ...DatabaseEnv, ...S3Env })
const db = createDb(env.DATABASE_URL)
const demos = createS3Storage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET_DEMOS,
})
const { match, matchPlayer } = schema

const pending = await db
  .selectDistinct({ id: match.id })
  .from(match)
  .innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
  .where(and(isNotNull(match.demoKey), isNull(matchPlayer.crosshair)))

console.log(`${pending.length} matches to backfill`)
for (const [i, { id }] of pending.entries()) {
  try {
    const demo = openDemo(Buffer.from(await Bun.zstdDecompress(await demos.bytes(keys.demo(id)))))
    const codes = latestCrosshairs(demo.snapshots(demo.events.freezeEnds))
    for (const [steamId, crosshair] of codes) {
      await db
        .update(matchPlayer)
        .set({ crosshair })
        .where(and(eq(matchPlayer.matchId, id), eq(matchPlayer.steamId, steamId)))
    }
    console.log(`${i + 1}/${pending.length} ${id}: ${codes.size} crosshairs`)
  } catch (error) {
    console.error(`${i + 1}/${pending.length} ${id}: failed`, error)
  }
}
process.exit(0)
