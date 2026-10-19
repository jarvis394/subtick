import { type MatchStatus, isProcessingStatus, mapName } from '@subtick/domain'
import { Map as MapGlyph } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Map art from the Counter-Strike wiki (fetched by `scripts/fetch-map-assets.ts`):
 * src/assets/maps/<map>.webp is the emblem, src/assets/maps/preview/<map>.webp a screenshot.
 */
const urls = (files: Record<string, string>) =>
  new Map(
    Object.entries(files).map(([path, url]) => [
      path
        .split('/')
        .at(-1)!
        .replace(/\.\w+$/, ''),
      url,
    ]),
  )

const EMBLEMS = urls(
  import.meta.glob<string>('../assets/maps/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)
const PREVIEWS = urls(
  import.meta.glob<string>('../assets/maps/preview/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)

/**
 * A match's name: its map, which only the demo says. Until the demo is analyzed it's a new match;
 * one that never got that far (expired, failed) stays on an unknown map.
 */
export const matchName = (map: string | null, status: MatchStatus) =>
  map ? mapName(map) : isProcessingStatus(status) ? 'New match' : mapName(map)

export const mapPreviewUrl = (map: string | null) => (map ? PREVIEWS.get(map) : undefined)

/** Emblem, a monogram tile for maps without art, or a map glyph while the map isn't known. */
export const MapIcon = ({ map, className }: { map: string | null; className?: string }) => {
  const emblem = map ? EMBLEMS.get(map) : undefined
  if (emblem) {
    return (
      <img
        src={emblem}
        alt=""
        draggable={false}
        className={cn('size-9 shrink-0 object-contain', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 font-serif text-[15px] text-muted',
        className,
      )}
    >
      {map ? mapName(map).charAt(0) : <MapGlyph className="size-[45%]" />}
    </span>
  )
}
