import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { MapIcon } from '@/components/map-icon'
import { MatchStatusBadge } from '@/components/match-status'
import { RankBadge } from '@/components/rank-badge'
import { formatDate } from '@/lib/format'
import type { MatchListItem } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** Score from the player's perspective: own team first. */
export const perspectiveScore = (
  match: { scoreStartedCt: number | null; scoreStartedT: number | null },
  side: 'CT' | 'T' | null | undefined,
) => {
  if (match.scoreStartedCt === null || match.scoreStartedT === null || !side) return null
  const own = side === 'CT' ? match.scoreStartedCt : match.scoreStartedT
  const enemy = side === 'CT' ? match.scoreStartedT : match.scoreStartedCt
  return { own, enemy, result: own > enemy ? 'win' : own < enemy ? 'loss' : 'draw' } as const
}

// One grid for header and rows. Narrow screens keep map, score and rating only.
const GRID =
  'grid grid-cols-[minmax(0,1fr)_4rem_3.5rem] items-center gap-x-3 px-4 md:grid-cols-[minmax(8rem,1.3fr)_7rem_4rem_minmax(7.5rem,auto)_3.5rem_2.5rem_2.5rem_2.5rem_3rem_3rem_3rem_minmax(6rem,auto)] md:px-5'
const WIDE = 'hidden md:block'

const ratingTone = (rating: number) =>
  rating >= 1.2 ? 'text-success' : rating < 0.85 ? 'text-danger' : 'text-foreground'

export const MatchTable = ({ matches }: { matches: MatchListItem[] }) => (
  // Edge to edge on phones (cancels the page's px-4), a card from md up.
  <div className="-mx-4 overflow-hidden border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
    <div className={cn(GRID, 'h-10 border-b text-[12px] font-medium text-muted')}>
      <span>Map</span>
      <span className={WIDE}>Date</span>
      <span className="text-right md:text-left">Score</span>
      <span className={WIDE}>Rank</span>
      <span className="text-right">Rating</span>
      <span className={cn(WIDE, 'text-right')}>K</span>
      <span className={cn(WIDE, 'text-right')}>D</span>
      <span className={cn(WIDE, 'text-right')}>A</span>
      <span className={cn(WIDE, 'text-right')}>K/D</span>
      <span className={cn(WIDE, 'text-right')}>ADR</span>
      <span className={cn(WIDE, 'text-right')}>HS%</span>
      <span className={cn(WIDE, 'text-right')}>Clips</span>
    </div>

    {matches.map((match) => {
      const score = perspectiveScore(match, match.player?.startingSide)
      const s = match.player?.stats
      const kd = s ? (s.deaths ? s.kills / s.deaths : s.kills) : null

      return (
        <Link
          key={match.id}
          to="/matches/$id"
          params={{ id: match.id }}
          className={cn(
            GRID,
            'h-16 border-b text-sm tabular-nums outline-none last:border-0',
            'hover:bg-surface-2/60 focus-visible:bg-surface-2/60',
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <MapIcon map={match.map} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{mapName(match.map)}</span>
              <span className="block truncate text-[12px] text-muted md:hidden">
                {formatDate(match.playedAt ?? match.discoveredAt)}
              </span>
            </span>
          </span>
          <span className={cn(WIDE, 'text-muted')}>
            {formatDate(match.playedAt ?? match.discoveredAt)}
          </span>
          <span className="text-right font-mono md:text-left">
            {score ? (
              <>
                <span
                  className={cn(
                    score.result === 'win'
                      ? 'text-success'
                      : score.result === 'loss' && 'text-danger',
                  )}
                >
                  {score.own}
                </span>
                <span className="text-muted">:</span>
                {score.enemy}
              </>
            ) : (
              <MatchStatusBadge status={match.status} />
            )}
          </span>
          <span className={cn(WIDE, 'min-w-0')}>
            <RankBadge rank={match.player?.rank} />
          </span>
          <span className={cn('text-right font-medium', s ? ratingTone(s.rating) : 'text-muted')}>
            {s ? s.rating.toFixed(2) : '–'}
          </span>
          <span className={cn(WIDE, 'text-right')}>{s?.kills ?? '–'}</span>
          <span className={cn(WIDE, 'text-right text-muted')}>{s?.deaths ?? '–'}</span>
          <span className={cn(WIDE, 'text-right text-muted')}>{s?.assists ?? '–'}</span>
          <span className={cn(WIDE, 'text-right')}>{kd !== null ? kd.toFixed(2) : '–'}</span>
          <span className={cn(WIDE, 'text-right')}>{s ? Math.round(s.adr) : '–'}</span>
          <span className={cn(WIDE, 'text-right text-muted')}>
            {s ? `${Math.round(s.hsPercent)}%` : '–'}
          </span>
          <span className={cn(WIDE, 'text-right')}>
            {score && match.status !== 'ready' ? (
              <MatchStatusBadge status={match.status} />
            ) : match.highlightCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Play strokeWidth={2} className="size-3 fill-foreground/16" />
                {match.highlightCount}
              </span>
            ) : (
              <span className="text-muted">–</span>
            )}
          </span>
        </Link>
      )
    })}
  </div>
)
