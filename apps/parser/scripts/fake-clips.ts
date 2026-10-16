/* oxlint-disable no-await-in-loop -- one clip at a time keeps ffmpeg and uploads simple */
/**
 * Dev only: marks the signed-up users' own highlights as recorded with placeholder clips
 * (a slow zoom over the map's preview image), so the UI can be built before the recorder exists.
 *   bun run fake-clips
 */
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseEnv, S3Env, loadEnv } from '@subtick/config'
import { and, createDb, eq, inArray, schema } from '@subtick/db'
import { TICKRATE } from '@subtick/domain'
import { createS3Storage, keys } from '@subtick/storage'

const env = loadEnv({ ...DatabaseEnv, ...S3Env })
const db = createDb(env.DATABASE_URL)
const clips = createS3Storage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET_CLIPS,
})
const PREVIEWS = new URL('../../web/src/assets/maps/preview/', import.meta.url).pathname
const WORK = '/tmp/subtick/fake-clips'
const SECONDS = 6

const ffmpeg = async (...args: string[]) => {
  const proc = Bun.spawn(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args])
  if ((await proc.exited) !== 0) throw new Error(`ffmpeg ${args.join(' ')} failed`)
}

/** One placeholder video + thumbnail per map, reused for all of that map's highlights. */
const renderMap = async (map: string) => {
  const video = join(WORK, `${map}.mp4`)
  const thumb = join(WORK, `${map}.jpg`)
  if (await Bun.file(video).exists()) return { video, thumb }
  const source = join(PREVIEWS, `${map}.webp`)
  await ffmpeg('-i', source, '-frames:v', '1', '-q:v', '3', thumb)
  await ffmpeg(
    '-loop',
    '1',
    '-i',
    thumb,
    '-vf',
    `scale=1600:900,zoompan=z='1+0.0008*on':d=${SECONDS * 30}:s=1280x720:fps=30,format=yuv420p`,
    '-t',
    String(SECONDS),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-movflags',
    '+faststart',
    video,
  )
  return { video, thumb }
}

await mkdir(WORK, { recursive: true })
const rows = await db
  .select({ highlight: schema.highlight, map: schema.match.map })
  .from(schema.highlight)
  .innerJoin(schema.match, eq(schema.match.id, schema.highlight.matchId))
  .innerJoin(
    schema.userMatch,
    and(
      eq(schema.userMatch.matchId, schema.highlight.matchId),
      eq(schema.userMatch.steamId, schema.highlight.steamId),
    ),
  )

for (const { highlight, map } of rows) {
  if (!map) continue
  const { video, thumb } = await renderMap(map)
  await clips.put(keys.clip(highlight.id), Bun.file(video), 'video/mp4')
  await clips.put(keys.thumbnail(highlight.id), Bun.file(thumb), 'image/jpeg')
  await db
    .insert(schema.clip)
    .values({
      highlightId: highlight.id,
      videoKey: keys.clip(highlight.id),
      thumbnailKey: keys.thumbnail(highlight.id),
      durationMs: Math.round(((highlight.endTick - highlight.startTick) / TICKRATE) * 1000),
      width: 1280,
      height: 720,
      recorderVersion: 0,
    })
    .onConflictDoNothing()
  await db
    .update(schema.highlight)
    .set({ status: 'recorded' })
    .where(eq(schema.highlight.id, highlight.id))
}

// What the recorder does after a batch: matches with nothing left to record are done.
const matchIds = [...new Set(rows.map((r) => r.highlight.matchId))]
if (matchIds.length)
  await db
    .update(schema.match)
    .set({ status: 'ready' })
    .where(and(inArray(schema.match.id, matchIds), eq(schema.match.status, 'recording')))

await rm(WORK, { recursive: true, force: true })
console.log(`recorded ${rows.length} placeholder clips`)
process.exit(0)
