import type { HighlightKind, KillTag } from '@subtick/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HighlightPlayer } from '@/components/highlight-card'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Spinner } from '@/components/ui/surface'
import { api, unwrap } from '@/lib/api'
import { clipLength } from '@/lib/format'
import { KIND_LABEL, tagSummary } from '@/lib/highlights'

export interface Moment {
  id: string
  kind: HighlightKind
  title: string
  round: number
  startTick: number
  endTick: number
  status: 'candidate' | 'queued' | 'recorded' | 'skipped' | 'failed'
  kills: { tags: KillTag[] }[]
}

/** A detected moment that has no clip yet: compact, with a way to request one. */
export const MomentRow = ({ moment, player }: { moment: Moment; player?: HighlightPlayer }) => {
  const queryClient = useQueryClient()
  const record = useMutation({
    mutationFn: () => unwrap(api.highlights({ id: moment.id }).record.post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match'] }),
  })
  const status = record.isSuccess ? 'queued' : moment.status

  return (
    <div className="flex min-h-14 items-center gap-3 border-b px-4 py-2 last:border-0">
      <Badge className="w-[4.5rem] justify-center">{KIND_LABEL[moment.kind]}</Badge>
      {player && <Avatar src={player.avatarUrl} name={player.name} className="size-7" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{moment.title}</p>
        <p className="truncate text-[12px] text-muted">
          {[
            player?.name,
            `Round ${moment.round}`,
            clipLength(moment.startTick, moment.endTick),
            ...tagSummary(moment.kills),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {status === 'queued' ? (
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <Spinner className="size-3" /> Recording
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => record.mutate()}
          disabled={record.isPending}
        >
          {status === 'failed' ? 'Retry' : 'Record'}
        </Button>
      )}
    </div>
  )
}
