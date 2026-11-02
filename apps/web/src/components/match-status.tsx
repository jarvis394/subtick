import type { MatchStatus } from '@subtick/domain'
import { Badge, Spinner } from '@/components/ui/surface'
import { percent } from '@/hooks/use-match-events'

export const STATUS_LABELS: Record<Exclude<MatchStatus, 'ready'>, string> = {
  queued: 'Queued',
  resolving: 'Finding demo',
  downloading: 'Downloading',
  parsing: 'Analyzing',
  recording: 'Recording clips',
  failed: 'Failed',
  expired: 'Demo expired',
}

export const MatchStatusBadge = ({
  status,
  cancelled,
  progress,
  className,
}: {
  status: MatchStatus
  /** Stopped by someone: failed, but nothing went wrong. */
  cancelled?: boolean
  /** 0..1 within the current stage, when it reports one. */
  progress?: number
  className?: string
}) => {
  if (status === 'ready') return null
  if (cancelled) return <Badge className={className}>Cancelled</Badge>
  if (status === 'failed' || status === 'expired') {
    return (
      <Badge tone="danger" className={className}>
        {STATUS_LABELS[status]}
      </Badge>
    )
  }

  return (
    <Badge tone="accent" className={className}>
      <Spinner className="size-2.5 border-[1.5px]" />
      {STATUS_LABELS[status]}
      {progress !== undefined && <span className="tabular-nums">{percent(progress)}</span>}
    </Badge>
  )
}

export const isProcessing = (status: MatchStatus) =>
  !['ready', 'failed', 'expired'].includes(status)
