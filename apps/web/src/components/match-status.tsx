import type { MatchStatus } from '@subtick/domain'
import { Badge, Spinner } from '@/components/ui/surface'

const LABELS: Record<Exclude<MatchStatus, 'ready'>, string> = {
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
  className,
}: {
  status: MatchStatus
  className?: string
}) => {
  if (status === 'ready') return null
  if (status === 'failed' || status === 'expired') {
    return (
      <Badge tone="danger" className={className}>
        {LABELS[status]}
      </Badge>
    )
  }
  return (
    <Badge tone="accent" className={className}>
      <Spinner className="size-2.5 border-[1.5px]" />
      {LABELS[status]}
    </Badge>
  )
}

export const isProcessing = (status: MatchStatus) =>
  !['ready', 'failed', 'expired'].includes(status)
