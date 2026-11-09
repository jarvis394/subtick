import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Crosshair, Flame, Gauge, type LucideIcon, Swords, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { MapIcon, mapPreviewUrl } from '@/components/map-icon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { formatImpact, impactTone, type Played, ratingTone } from './facts'
import { ScoreBadge } from './score-badge'

const Stat = ({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  className?: string
}) => (
  <div className="text-center">
    <dt className="flex items-center justify-center gap-1 text-caption text-white/70">
      <Icon aria-hidden className="size-3" />
      {label}
    </dt>
    <dd className={cn('text-title font-semibold text-white tabular-nums', className)}>{value}</dd>
  </div>
)

/** The best match of the window: the map and score, then its numbers over the map's art. */
export const BestMapCard = ({ match }: { match: Played }) => {
  const preview = mapPreviewUrl(match.map)
  const { impact, rating, kills, deaths, adr, hsPercent } = match.stats

  return (
    <Card bleed recessed className="overflow-hidden md:-mx-4">
      <Link
        to="/matches/$id"
        params={{ id: match.matchId }}
        className="group/button flex h-11 items-center gap-2 pr-2 pl-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <MapIcon map={match.map} className="size-5" />
        <span className="truncate text-body font-medium">{mapName(match.map)}</span>
        <ScoreBadge match={match} />
        <Button size="xs" variant="ghost" className="ml-auto" render={<span />}>
          Go to match <ArrowRight />
        </Button>
      </Link>

      <Card className="rounded-none border-x-0 border-b-0 p-2 md:rounded-t-xl">
        <div className="theme-dark relative isolate overflow-hidden rounded-md bg-black">
          {preview && (
            <img
              src={preview}
              alt=""
              draggable={false}
              className="absolute inset-0 -z-10 size-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/60 via-black/35 to-black/10" />
          <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-16 py-3.5">
            {impact !== undefined && (
              <Stat
                icon={Zap}
                label="Impact"
                value={formatImpact(impact)}
                className={impactTone(impact)}
              />
            )}
            <Stat
              icon={Gauge}
              label="Rating"
              value={rating.toFixed(2)}
              className={ratingTone(rating)}
            />
            <Stat
              icon={Swords}
              label="K / D"
              value={
                <>
                  {kills}
                  <span className="mx-1 font-normal text-white/40">/</span>
                  {deaths}
                </>
              }
            />
            <Stat icon={Flame} label="ADR" value={Math.round(adr)} />
            <Stat icon={Crosshair} label="HS%" value={`${Math.round(hsPercent)}%`} />
          </dl>
        </div>
      </Card>
    </Card>
  )
}
