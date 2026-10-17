import { Dialog } from '@base-ui/react/dialog'
import type { HighlightClutch, HighlightKind, KillTag } from '@subtick/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentBadge } from '@/components/moment-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/surface'
import { api, unwrap } from '@/lib/api'
import { clipLength } from '@/lib/format'
import { tagSummary } from '@/lib/highlights'
import type { MatchDetail } from '@/lib/queries'

export interface Moment {
  id: string
  steamId: string
  kind: HighlightKind
  title: string
  round: number
  startTick: number
  endTick: number
  status: 'candidate' | 'queued' | 'recorded' | 'skipped' | 'failed'
  kills: { tags: KillTag[] }[]
  clutch: HighlightClutch | null
}

/**
 * A detected moment that has no clip yet: compact, with a way to request one. Clicking it shows
 * the moment's killfeed.
 */
export const MomentRow = ({
  moment,
  match,
  player,
}: {
  moment: Moment
  match: MatchDetail
  player?: HighlightPlayer
}) => {
  const queryClient = useQueryClient()
  const record = useMutation({
    mutationFn: () => unwrap(api.highlights({ id: moment.id }).record.post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match'] }),
  })
  const status = record.isSuccess ? 'queued' : moment.status
  const details = [
    player?.name,
    `Round ${moment.round}`,
    clipLength(moment.startTick, moment.endTick),
    ...tagSummary(moment.kills),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex min-h-14 items-center gap-3 border-b pr-4 last:border-0">
      <KillfeedDialog
        match={match}
        moment={moment}
        subtitle={details}
        trigger={
          <Dialog.Trigger className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <MomentBadge moment={moment} />
            {player && <Avatar src={player.avatarUrl} name={player.name} className="size-7" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{moment.title}</p>
              <p className="truncate text-[12px] text-muted">{details}</p>
            </div>
          </Dialog.Trigger>
        }
      />
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
