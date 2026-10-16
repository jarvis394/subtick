import { type PlayerRank, type PremierTier, premierTier, skillGroupName } from '@subtick/domain'
import { cn } from '@/lib/utils'

const TIER_COLORS: Record<PremierTier, string> = {
  grey: '#b5b5b5',
  cyan: '#79c3ea',
  blue: '#5a86e6',
  purple: '#a768e8',
  pink: '#e26ad0',
  red: '#e65a52',
  gold: '#f0c04c',
}

const number = new Intl.NumberFormat('en')

/**
 * Premier: the CS Rating in a slanted, tier-colored plate (like in game) plus the change.
 * Competitive/Wingman: the skill group name.
 */
export const RankBadge = ({
  rank,
  showChange = true,
  className,
}: {
  rank: PlayerRank | null | undefined
  showChange?: boolean
  className?: string
}) => {
  if (!rank || rank.after === 0) return <span className={cn('text-muted', className)}>–</span>

  if (rank.mode !== 'premier') {
    return (
      <span className={cn('truncate text-muted', className)}>{skillGroupName(rank.after)}</span>
    )
  }

  const color = TIER_COLORS[premierTier(rank.after)]
  return (
    <span className={cn('inline-flex items-center gap-2 tabular-nums', className)}>
      <span
        style={{ '--tier': color } as React.CSSProperties}
        className="inline-flex h-5 -skew-x-12 items-center rounded-[3px] border-l-[3px] border-(--tier) bg-[color-mix(in_srgb,var(--tier)_16%,transparent)] px-1.5"
      >
        <span className="skew-x-12 font-mono text-[12px] font-semibold text-(--tier) italic">
          {number.format(rank.after)}
        </span>
      </span>
      {showChange && rank.change !== 0 && (
        <span className={cn('text-[12px]', rank.change > 0 ? 'text-success' : 'text-danger')}>
          {rank.change > 0 ? '+' : ''}
          {number.format(rank.change)}
        </span>
      )}
    </span>
  )
}
