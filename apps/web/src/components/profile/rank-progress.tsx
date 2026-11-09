import { mapName, premierTier, skillGroupName } from '@subtick/domain'
import { useId, useState } from 'react'
import { TIER_COLORS } from '@/components/rank-badge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Played } from './facts'

const number = new Intl.NumberFormat('en')

const MODE_LABEL = { premier: 'Premier rating', competitive: 'Competitive', wingman: 'Wingman' }

type RankedMode = keyof typeof MODE_LABEL

/** Oldest first. Premier when there's a line to draw, else whichever skill-group mode has one. */
const rankSeries = (history: Played[]) => {
  const ofMode = (mode: RankedMode) =>
    history
      .flatMap((m) =>
        m.rank?.mode === mode && m.rank.after > 0 ? [{ match: m, rank: m.rank }] : [],
      )
      .toReversed()

  const mode = (['premier', 'competitive', 'wingman'] as const).find((m) => ofMode(m).length > 1)

  return mode ? { mode, points: ofMode(mode) } : null
}

/** A rating line over the player's ranked matches, evenly spaced: one step per match played. */
export const RankProgressChart = ({ history }: { history: Played[] }) => {
  const series = rankSeries(history)
  const [hovered, setHovered] = useState<number | null>(null)
  // React's ids hold characters a url(#…) reference can't always carry.
  const gradient = useId().replace(/\W/g, '')
  if (!series)
    return <p className="text-small text-muted">Play two ranked matches to start the line.</p>

  const { mode, points } = series
  const values = points.map((p) => p.rank.after)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.12, mode === 'premier' ? 50 : 0.5)
  const floor = low - pad
  const span = high + pad - floor
  const latest = values.at(-1)!
  const moved = latest - values[0]!
  const color = mode === 'premier' ? TIER_COLORS[premierTier(latest)] : 'var(--color-foreground)'
  const active = hovered === null ? null : points[hovered]!

  const format = (value: number) =>
    mode === 'premier' ? number.format(value) : skillGroupName(value)

  const x = (i: number) => (i / (points.length - 1)) * 100

  const y = (value: number) => 100 - ((value - floor) / span) * 100

  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.rank.after).toFixed(2)}`)
    .join(' ')

  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect()
    const at = Math.round(((event.clientX - left) / width) * (points.length - 1))
    setHovered(Math.min(Math.max(at, 0), points.length - 1))
  }

  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3 text-small">
        <span className="text-muted">{MODE_LABEL[mode]}</span>
        {mode === 'premier' && moved !== 0 && (
          <span
            className={cn('font-medium tabular-nums', moved > 0 ? 'text-success' : 'text-danger')}
          >
            {moved > 0 ? '+' : ''}
            {number.format(moved)}
            <span className="font-normal text-muted"> over {points.length} matches</span>
          </span>
        )}
      </figcaption>
      <div
        role="img"
        aria-label={`${MODE_LABEL[mode]} over ${points.length} matches: from ${format(values[0]!)} to ${format(latest)}, highest ${format(high)}.`}
        onPointerDown={pick}
        onPointerMove={pick}
        onPointerLeave={() => setHovered(null)}
        className="relative h-24 touch-pan-y select-none"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.2" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100 100 L0 100 Z`} fill={`url(#${gradient})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span className="pointer-events-none absolute top-0 left-0 text-micro text-muted tabular-nums">
          {format(high)}
        </span>
        <span className="pointer-events-none absolute bottom-0 left-0 text-micro text-muted tabular-nums">
          {format(low)}
        </span>

        {active ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20"
              style={{ left: `${x(hovered!)}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute size-2 -translate-1/2 rounded-full ring-2 ring-surface"
              style={{
                left: `${x(hovered!)}%`,
                top: `${y(active.rank.after)}%`,
                backgroundColor: color,
              }}
            />
          </>
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
            style={{ top: `${y(latest)}%`, backgroundColor: color }}
          />
        )}
      </div>
      <p className="mt-2 flex min-h-4 justify-between gap-3 text-caption text-muted tabular-nums">
        {active ? (
          <>
            <span className="truncate font-medium text-foreground">
              {format(active.rank.after)}
              {active.rank.change !== 0 && (
                <span className={active.rank.change > 0 ? 'text-success' : 'text-danger'}>
                  {' '}
                  {active.rank.change > 0 ? '+' : ''}
                  {number.format(active.rank.change)}
                </span>
              )}
            </span>
            <span className="truncate">
              {mapName(active.match.map)}, {formatDate(active.match.playedAt)}
            </span>
          </>
        ) : (
          <>
            <span>{formatDate(points[0]!.match.playedAt)}</span>
            <span>{formatDate(points.at(-1)!.match.playedAt)}</span>
          </>
        )}
      </p>
    </figure>
  )
}
