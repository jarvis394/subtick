import { schema, sql } from '@subtick/db'
import type { Context } from '../context'

/**
 * Hides single-kill moments that analysis before parser v4 still stored; they are never shown,
 * however special the kill, unless they won a 1v2 or harder.
 */
export const notOneKill = sql`(
  jsonb_array_length(${schema.highlight.kills}) <> 1
  or (${schema.highlight.clutch} ->> 'opponents')::int >= 2
)`

type HighlightRow = typeof schema.highlight.$inferSelect
type ClipRow = typeof schema.clip.$inferSelect

/** Attaches short-lived URLs for recorded clips; the api never proxies video bytes. */
export const withClipUrls = (
  { clips }: Pick<Context, 'clips'>,
  rows: { highlight: HighlightRow; clip: ClipRow | null }[],
) =>
  rows.map(({ highlight, clip }) => ({
    ...highlight,
    clip: clip && {
      durationMs: clip.durationMs,
      width: clip.width,
      height: clip.height,
      // The row's keys, not `keys.*`: clips recorded before the WebP switch keep a `.jpg` poster.
      videoUrl: clips.presign(clip.videoKey),
      thumbnailUrl: clips.presign(clip.thumbnailKey),
    },
  }))
