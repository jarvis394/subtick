import { Dialog } from '@base-ui/react/dialog'
import type { ClipSegment, HighlightClutch, HighlightKind, KillTag } from '@subtick/domain'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentBadge } from '@/components/moment-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/surface'
import { useRecordMoment } from '@/hooks/use-record-moment'
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
  segments: ClipSegment[]
  status: 'candidate' | 'queued' | 'recorded' | 'skipped' | 'failed'
  kills: { tags: KillTag[] }[]
  clutch: HighlightClutch | null
}

/** The moment's line under its title: round, length and its standout kill tags. */
export const momentDetails = (moment: Moment) =>
  [`Round ${moment.round}`, clipLength(moment), ...tagSummary(moment.kills)].join(' · ')

/**
 * A moment waiting on its clip, as the match page's Queue lists it: recording, or failed with a
 * way to retry. Clicking it shows the moment's killfeed.
 */
export const MomentRow = ({
  moment,
  match,
  player,
  owner,
}: {
  moment: Moment
  match: MatchDetail
  /** Shown when the list mixes players' moments. */
  player?: HighlightPlayer
  /** Whose moment it is, for the killfeed dialog's header. */
  owner: HighlightPlayer
}) => {
  const record = useRecordMoment(match.match.id)
  const details = [player?.name, momentDetails(moment)].filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-14 items-center gap-3 border-b pr-4 last:border-0">
      <KillfeedDialog
        match={match}
        moment={moment}
        player={owner}
        subtitle={momentDetails(moment)}
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
      {moment.status === 'failed' ? (
        <Button
          size="sm"
          variant="brand-soft"
          onClick={() => record.mutate(moment.id)}
          disabled={record.isPending}
        >
          Retry
        </Button>
      ) : (
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <Spinner className="size-3" /> Recording
        </span>
      )}
    </div>
  )
}
