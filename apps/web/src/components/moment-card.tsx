import { Dialog } from '@base-ui/react/dialog'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentBadge } from '@/components/moment-badge'
import { type Moment, momentDetails } from '@/components/moment-row'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/surface'
import type { MatchDetail } from '@/lib/queries'

/**
 * A moment on the Create highlights page: an outlined card that opens its killfeed, with its
 * action on the side. `moment-card` lets the queue view transition morph it into the Queue.
 */
export const MomentCard = ({
  moment,
  match,
  player,
  onRecord,
  recording,
}: {
  moment: Moment
  match: MatchDetail
  player: HighlightPlayer
  onRecord: () => void
  /** A record request for this card is in flight. */
  recording: boolean
}) => (
  <div className="moment-card flex min-w-0 items-center gap-3 rounded-2xl border pr-3">
    <KillfeedDialog
      match={match}
      moment={moment}
      player={player}
      subtitle={momentDetails(moment)}
      trigger={
        <Dialog.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-2xl py-3 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <Avatar src={player.avatarUrl} name={player.name} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{moment.title}</p>
              <MomentBadge moment={moment} className="w-auto shrink-0" />
            </div>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {player.name} · {momentDetails(moment)}
            </p>
          </div>
        </Dialog.Trigger>
      }
    />
    {moment.status === 'queued' ? (
      <span className="flex shrink-0 items-center gap-1.5 px-1 text-[13px] text-muted">
        <Spinner className="size-3" /> Recording
      </span>
    ) : (
      <Button
        size="sm"
        variant={moment.status === 'failed' ? 'brand-soft' : 'secondary'}
        onClick={onRecord}
        disabled={recording}
      >
        {moment.status === 'failed' ? 'Retry' : 'Record'}
      </Button>
    )}
  </div>
)
