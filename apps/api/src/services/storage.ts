import { sql } from '@subtick/db'
import type { Context } from '../context'

export type StorageCategory = 'demos' | 'clips' | 'thumbnails' | 'database' | 'other'

interface Usage {
  bytes: number
  count: number
}

/** The disk SeaweedFS writes to, as its volume server reports it. */
const diskStatus = async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
  if (!res.ok) throw new Error(`disk status: HTTP ${res.status}`)
  const body = (await res.json()) as {
    DiskStatuses?: { all: number; used: number; free: number }[]
  }
  const disks = body.DiskStatuses ?? []
  if (disks.length === 0) return null
  // Several data dirs on one disk would count it twice; `weed server` has one.
  return disks.reduce(
    (sum, d) => ({
      total: sum.total + d.all,
      used: sum.used + d.used,
      free: sum.free + d.free,
    }),
    { total: 0, used: 0, free: 0 },
  )
}

const CACHE_MS = 30_000
const IMAGE = /\.(webp|jpe?g)$/

/**
 * What subtick's data takes, by kind, and the disk it sits on. Listing every object is a few
 * requests per thousand, so a result is reused for a little while.
 */
export const createStorageReport = ({ db, demos, clips, env, log }: Context) => {
  let cached: { at: number; report: Promise<StorageReport> } | null = null

  const build = async () => {
    const usage: Record<StorageCategory, Usage> = {
      demos: { bytes: 0, count: 0 },
      clips: { bytes: 0, count: 0 },
      thumbnails: { bytes: 0, count: 0 },
      database: { bytes: 0, count: 1 },
      other: { bytes: 0, count: 0 },
    }
    const add = (category: StorageCategory, size: number) => {
      usage[category].bytes += size
      usage[category].count += 1
    }

    const [disk] = await Promise.all([
      env.S3_DISK_STATUS_URL
        ? diskStatus(env.S3_DISK_STATUS_URL).catch((error) => {
            log.warn({ error: String(error) }, 'disk status unavailable')
            return null
          })
        : null,
      (async () => {
        for await (const { key, size } of demos.objects())
          add(key.endsWith('.dem.zst') ? 'demos' : 'other', size)
      })(),
      (async () => {
        // Posters were .jpg before they moved to .webp.
        for await (const { key, size } of clips.objects())
          add(key.endsWith('.mp4') ? 'clips' : IMAGE.test(key) ? 'thumbnails' : 'other', size)
      })(),
      (async () => {
        const rows = await db.execute<{ bytes: string }>(
          sql`select pg_database_size(current_database())::text as bytes`,
        )
        usage.database.bytes = Number(rows[0]?.bytes ?? 0)
      })(),
    ])

    return { usage, disk, measuredAt: new Date().toISOString() }
  }

  return () => {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      const report = build()
      cached = { at: Date.now(), report }
      // A failed report isn't kept, so the next request tries again.
      report.catch(() => {
        if (cached?.report === report) cached = null
      })
    }
    return cached.report
  }
}

export interface StorageReport {
  usage: Record<StorageCategory, Usage>
  disk: { total: number; used: number; free: number } | null
  measuredAt: string
}
