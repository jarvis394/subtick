import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import type { FocusEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { MapIcon } from '@/components/map-icon'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatImpact, impactTone, type Played, RESULT_LABEL } from './facts'
import { ScoreBadge } from './score-badge'

/** Ratings this far from 1.00 take the full color, so an outlier never washes out the rest. */
const RATING_SPREAD = 0.5

// The columns and the 1.00 line have to agree on it, with headroom for the tallest bar's rating.
export const PLOT_BOX = 'h-32 pt-5 md:h-44'

// The raw tokens: Tailwind only emits a `--color-*` variable it finds written out in full.
const RATING_MIDPOINT = 'color-mix(in oklab, var(--foreground) 70%, var(--muted))'

/** What the columns report so the chart can decide when its popup opens. */
export type PopupControl = {
  onColumn: (m: Played, e: ReactPointerEvent) => void
  onFocus: (m: Played, e: FocusEvent<HTMLElement>) => void
  onClose: () => void
}

export const barPercent = (rating: number, max: number) => Math.max((rating / max) * 100, 3)

const ratingColor = (rating: number) => {
  const pole = rating >= 1 ? 'var(--success)' : 'var(--danger)'
  const strength = Math.min(Math.abs(rating - 1) / RATING_SPREAD, 1) * 100

  return `color-mix(in oklab, ${pole} ${strength}%, ${RATING_MIDPOINT})`
}

const describe = ({ map, score, result, stats, playedAt }: Played) =>
  [
    `${mapName(map)}${score ? ` ${score.own}:${score.enemy}` : ''}`,
    result && RESULT_LABEL[result].toLowerCase(),
    stats.impact !== undefined && `impact ${formatImpact(stats.impact)}`,
    `rating ${stats.rating.toFixed(2)}`,
    `${stats.kills} kills, ${stats.deaths} deaths`,
    `${Math.round(stats.adr)} ADR`,
    formatDate(playedAt),
  ]
    .filter(Boolean)
    .join(', ')

const TipRow = ({
  label,
  children,
  className,
  color,
}: {
  label: string
  children: ReactNode
  className?: string
  color?: string
}) => (
  <tr>
    <th scope="row" className="py-0.5 text-left font-normal text-muted">
      {label}
    </th>
    <td className={cn('py-0.5 text-right font-medium', className)} style={{ color }}>
      {children}
    </td>
  </tr>
)

export const MatchTip = ({ m }: { m: Played }) => {
  const { impact, rating, kills, deaths, adr } = m.stats

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <MapIcon map={m.map} className="size-5" />
        <span className="truncate text-body font-medium">{mapName(m.map)}</span>
        <ScoreBadge match={m} />
      </div>
      {/* Every row always renders, so the popup keeps its height from match to match. */}
      <table className="w-full tabular-nums">
        <tbody>
          <TipRow label="Impact" className={impact === undefined ? undefined : impactTone(impact)}>
            {impact === undefined ? '–' : formatImpact(impact)}
          </TipRow>
          <TipRow label="Rating" color={ratingColor(rating)}>
            {rating.toFixed(2)}
          </TipRow>
          <TipRow label="K / D">
            {kills}
            <span className="mx-1 font-normal text-muted">/</span>
            {deaths}
          </TipRow>
          <TipRow label="ADR">{Math.round(adr)}</TipRow>
        </tbody>
      </table>
      <span className="text-caption text-muted">{formatDate(m.playedAt)}</span>
    </div>
  )
}

export const MatchColumn = ({ m, max, hovered }: { m: Played; max: number; hovered: boolean }) => {
  const height = barPercent(m.stats.rating, max)
  const color = ratingColor(m.stats.rating)

  return (
    <Link
      to="/matches/$id"
      params={{ id: m.matchId }}
      aria-label={describe(m)}
      className="relative flex w-full flex-col items-center rounded-md outline-none after:absolute after:inset-y-0 after:-inset-x-0.5 group-first:after:-left-1.5 group-last:after:-right-1.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn('block w-full', PLOT_BOX)}>
        <span className="relative block h-full">
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 rounded-[3px] transition-opacity duration-150 group-focus-within:opacity-100',
              hovered ? 'opacity-100' : 'opacity-75',
            )}
            style={{ height: `${height}%`, backgroundColor: color }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 z-20 mb-1 flex justify-center text-micro font-medium tabular-nums"
            style={{ bottom: `${height}%`, color }}
          >
            <span className="rounded-sm bg-surface px-1">{m.stats.rating.toFixed(2)}</span>
          </span>
        </span>
      </span>
      <MapIcon map={m.map} className="mt-2 size-4 rounded-sm text-micro" />
      <ScoreBadge match={m} className="mt-1.5 text-micro" />
    </Link>
  )
}
