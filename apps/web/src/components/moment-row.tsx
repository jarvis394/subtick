import { Dialog } from '@base-ui/react/dialog'
import { RotateCw, X } from 'lucide-react'
import type { ClipSegment, HighlightClutch, HighlightKind, KillTag } from '@subtick/domain'
import { FailureNote } from '@/components/failure-note'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentBadge } from '@/components/moment-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { Spinner } from '@/components/ui/surface'
import { useCancelMoment } from '@/hooks/use-match-actions'
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
  /** Who asked for it to be recorded; null when subtick queued it itself. */
  requester?: { name: string; image: string | null; isViewer: boolean } | null
  /** The viewer may take it off the queue. */
  canCancel?: boolean
  /** Why its last recording failed. */
  error?: string | null
}

/** "Requested by you" / "by Name" / "Picked automatically", for a queued or failed moment. */
export const requestedLabel = (moment: Moment) =>
  moment.requester
    ? `Requested by ${moment.requester.isViewer ? 'you' : moment.requester.name}`
    : 'Picked automatically'

/** The moment's line under its title: round, length and its standout kill tags. */
export const momentDetails = (moment: Moment) =>
  [`Round ${moment.round}`, clipLength(moment), ...tagSummary(moment.kills)].join(' · ')

/** A queued or failed moment's dialog footer: what it waits on, with Retry or Cancel. */
export const MomentDialogFooter = ({ moment, matchId }: { moment: Moment; matchId: string }) => {
  const record = useRecordMoment(matchId)
  const cancel = useCancelMoment(matchId)
  const failed = moment.status === 'failed'
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
        {!failed && <Spinner className="size-3 shrink-0" />}
        <span className="truncate">
          {failed ? 'Recording failed' : 'Waiting to record'} · {requestedLabel(moment)}
        </span>
      </span>
      {failed ? (
        <Button
          size="sm"
          tone="brand"
          onClick={() => record.mutate(moment.id)}
          loading={record.isPending}
        >
          <RotateCw /> Retry
        </Button>
      ) : moment.canCancel ? (
        <Dialog.Close
          render={
            <Button
              size="sm"
              variant="ghost"
              tone="danger"
              onClick={() => cancel.mutate(moment.id)}
              disabled={cancel.isPending}
            />
          }
        >
          <X /> Cancel recording
        </Dialog.Close>
      ) : null}
    </>
  )
}

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
  const cancel = useCancelMoment(match.match.id)
  const details = [player?.name, momentDetails(moment), requestedLabel(moment)]
    .filter(Boolean)
    .join(' · ')
  const failed = moment.status === 'failed'

  return (
    <div className="flex min-h-14 items-center gap-3 pr-4">
      <KillfeedDialog
        match={match}
        moment={moment}
        player={owner}
        subtitle={momentDetails(moment)}
        notice={failed && <FailureNote error={moment.error} />}
        footer={<MomentDialogFooter moment={moment} matchId={match.match.id} />}
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
      {failed ? (
        <Button
          size="sm"
          tone="brand"
          onClick={() => record.mutate(moment.id)}
          loading={record.isPending}
        >
          Retry
        </Button>
      ) : (
        <span className="flex items-center gap-1">
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <Spinner className="size-3" /> Recording
          </span>
          {moment.canCancel && (
            <IconButton
              size="sm"
              label="Cancel recording"
              aria-label={`Cancel recording ${moment.title}`}
              onClick={() => cancel.mutate(moment.id)}
              loading={cancel.isPending}
            >
              <X />
            </IconButton>
          )}
        </span>
      )}
    </div>
  )
}
