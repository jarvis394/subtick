import { Dialog } from '@base-ui/react/dialog'
import { Circle, RotateCw, X } from 'lucide-react'
import { useRef } from 'react'
import { FailureNote } from '@/components/failure-note'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentBadge } from '@/components/moment-badge'
import { type Moment, momentDetails, requestedLabel } from '@/components/moment-row'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { Spinner } from '@/components/ui/surface'
import type { MatchDetail } from '@/lib/queries'

/**
 * A moment on the Create highlights page: an outlined card that opens its killfeed, with its
 * action on the side.
 */
export const MomentCard = ({
  moment,
  match,
  player,
  onRecord,
  recording,
  onCancel,
  cancelling,
}: {
  moment: Moment
  match: MatchDetail
  player: HighlightPlayer
  onRecord: () => void
  /** A record request for this card is in flight. */
  recording: boolean
  onCancel: () => void
  /** A cancel request for this card is in flight. */
  cancelling: boolean
}) => {
  // An action picked in the dialog runs once it has closed, so the card's move between the Queue
  // and its round plays on the page, not under the closing dialog.
  const afterClose = useRef<(() => void) | null>(null)
  const closeThen = (action: () => void) => () => {
    afterClose.current = action
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border pr-3">
      <KillfeedDialog
        match={match}
        moment={moment}
        player={player}
        subtitle={momentDetails(moment)}
        notice={moment.status === 'failed' && <FailureNote error={moment.error} />}
        onClosed={() => {
          afterClose.current?.()
          afterClose.current = null
        }}
        footer={
          <>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
              {moment.status === 'queued' && <Spinner className="size-3 shrink-0" />}
              <span className="truncate">
                {moment.status === 'queued'
                  ? `Waiting to record · ${requestedLabel(moment)}`
                  : moment.status === 'failed'
                    ? `Recording failed · ${requestedLabel(moment)}`
                    : 'Not recorded yet'}
              </span>
            </span>
            {moment.status === 'queued' ? (
              moment.canCancel && (
                <Dialog.Close
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="danger"
                      onClick={closeThen(onCancel)}
                      disabled={cancelling}
                    />
                  }
                >
                  <X /> Cancel recording
                </Dialog.Close>
              )
            ) : (
              <Dialog.Close
                render={
                  <Button
                    size="sm"
                    variant={moment.status === 'failed' ? 'secondary' : 'primary'}
                    tone={moment.status === 'failed' ? 'brand' : 'neutral'}
                    onClick={closeThen(onRecord)}
                    disabled={recording}
                  />
                }
              >
                {moment.status === 'failed' ? (
                  <RotateCw />
                ) : (
                  <Circle className="size-2.5! fill-current" />
                )}
                {moment.status === 'failed' ? 'Retry' : 'Record'}
              </Dialog.Close>
            )}
          </>
        }
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
                {moment.status !== 'candidate' && ` · ${requestedLabel(moment)}`}
              </p>
            </div>
          </Dialog.Trigger>
        }
      />
      {moment.status === 'queued' ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-1.5 px-1 text-[13px] text-muted">
            <Spinner className="size-3" /> Recording
          </span>
          {moment.canCancel && (
            <IconButton
              size="sm"
              label="Cancel recording"
              aria-label={`Cancel recording ${moment.title}`}
              onClick={onCancel}
              loading={cancelling}
            >
              <X />
            </IconButton>
          )}
        </span>
      ) : (
        <Button
          size="sm"
          tone={moment.status === 'failed' ? 'brand' : 'neutral'}
          onClick={onRecord}
          loading={recording}
        >
          {moment.status === 'failed' ? 'Retry' : 'Record'}
        </Button>
      )}
    </div>
  )
}
