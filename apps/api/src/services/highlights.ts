import type { schema } from '@subtick/db'
import { keys } from '@subtick/storage'
import type { Context } from '../context'

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
      videoUrl: clips.presign(keys.clip(highlight.id)),
      thumbnailUrl: clips.presign(keys.thumbnail(highlight.id)),
    },
  }))
