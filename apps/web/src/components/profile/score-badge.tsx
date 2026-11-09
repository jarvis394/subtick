import { Badge } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import type { Played } from './facts'

const TONE = { win: 'success', loss: 'danger', draw: 'neutral' } as const

export const ScoreBadge = ({
  match: { score, result },
  className,
}: {
  match: Played
  className?: string
}) =>
  score && (
    <Badge tone={result ? TONE[result] : 'neutral'} className={cn('gap-0 tabular-nums', className)}>
      {score.own}
      <span className="mx-0.5">:</span>
      {score.enemy}
    </Badge>
  )
