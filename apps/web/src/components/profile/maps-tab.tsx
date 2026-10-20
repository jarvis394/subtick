import { mapName } from '@subtick/domain'
import { Map as MapGlyph } from 'lucide-react'
import { MapIcon, mapPreviewUrl } from '@/components/map-icon'
import { FadeImage } from '@/components/ui/fade-image'
import { timeAgo } from '@/lib/format'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'

const winTone = (rate: number | null) =>
  rate === null ? 'text-muted' : rate >= 55 ? 'text-success' : rate < 45 ? 'text-danger' : undefined

export const MapsTab = ({ maps }: { maps: Player['maps'] }) => {
  if (!maps.length)
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted">
        <MapGlyph className="mx-auto mb-2 size-5" />
        No analyzed matches yet.
      </p>
    )

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {maps.map((m) => {
        const preview = mapPreviewUrl(m.map)
        return (
          <article key={m.map} className="overflow-hidden rounded-2xl border bg-surface">
            <div className="relative aspect-[2/1] bg-surface-2">
              {preview && <FadeImage src={preview} alt="" className="size-full object-cover" />}
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-4 bottom-3 flex items-center gap-2 text-white">
                <MapIcon map={m.map} className="size-7" />
                <h3 className="text-lg font-medium">{mapName(m.map)}</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn('text-2xl font-medium tabular-nums', winTone(m.winRate))}>
                  {m.winRate === null ? '–' : `${m.winRate}%`}
                  <span className="ml-1.5 text-[13px] font-normal text-muted">win rate</span>
                </p>
                <p className="text-[13px] text-muted tabular-nums">
                  {m.wins} of {m.matches}
                </p>
              </div>
              {m.winRate !== null && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-foreground/70"
                    style={{ width: `${m.winRate}%` }}
                  />
                </div>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm tabular-nums">
                {[
                  ['Rating', m.rating.toFixed(2)],
                  ['K/D', m.kd.toFixed(2)],
                  ['ADR', String(Math.round(m.adr))],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[12px] text-muted">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12px] text-muted">Last played {timeAgo(m.lastPlayedAt)}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
