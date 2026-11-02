import type { PartyMarker as Marker } from '@/lib/party'
import { Tooltip } from '@/components/ui/tooltip'

const PATHS: Record<Marker['symbol'], string> = {
  circle: 'M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1Z',
  square: 'M2 2h8v8H2Z',
  triangle: 'M6 1.5 11 10.5H1Z',
  diamond: 'M6 .8 11.2 6 6 11.2.8 6Z',
  star: 'm6 .9 1.5 3.2 3.5.4-2.6 2.4.7 3.5L6 8.7 2.9 10.4l.7-3.5L1 4.5l3.5-.4Z',
}

/** Party symbol, or an empty slot of the same width so rows stay aligned. */
export const PartyMarker = ({ marker }: { marker: Marker | undefined }) => (
  <Tooltip
    content={marker && 'Queued together'}
    trigger={
      <span className="grid w-3 shrink-0 place-items-center">
        {marker && (
          <svg viewBox="0 0 12 12" className="size-2.5" aria-label="Party" role="img">
            <path d={PATHS[marker.symbol]} fill={marker.color} />
          </svg>
        )}
      </span>
    }
  />
)
