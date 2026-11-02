import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FailureNote } from '@/components/failure-note'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { MomentDialogFooter, momentDetails } from '@/components/moment-row'
import { matchQuery } from '@/lib/queries'

export type MomentTarget = { matchId: string; momentId: string }

/**
 * A queued clip's moment, opened from the Queue page: its killfeed, why it failed if it did, and
 * Retry or Cancel. The queue doesn't carry the round's kills, so it reads the match.
 */
export const QueueMomentDialog = ({
  target,
  onClose,
}: {
  target: MomentTarget | null
  onClose: () => void
}) => {
  // Keep showing the last moment while the dialog animates out.
  const [shown, setShown] = useState(target)
  if (target && target !== shown) setShown(target)
  const { data } = useQuery({ ...matchQuery(shown?.matchId ?? ''), enabled: Boolean(shown) })
  const moment = data?.highlights.find((h) => h.id === shown?.momentId)
  // A dialog that mounts already open skips its enter transition: mount it closed, then open it.
  const ready = Boolean(data && moment)
  const [entered, setEntered] = useState(false)
  useEffect(() => setEntered(ready), [ready])
  if (!data || !moment) return null
  const owner = data.players.find((p) => p.steamId === moment.steamId)

  return (
    <KillfeedDialog
      open={Boolean(target) && entered}
      onOpenChange={(open) => !open && onClose()}
      onClosed={() => setShown(null)}
      match={data}
      moment={moment}
      player={{ name: owner?.name ?? 'Unknown', avatarUrl: owner?.avatarUrl ?? null }}
      subtitle={momentDetails(moment)}
      notice={moment.status === 'failed' && <FailureNote error={moment.error} />}
      footer={
        (moment.status === 'queued' || moment.status === 'failed') && (
          <MomentDialogFooter moment={moment} matchId={data.match.id} />
        )
      }
    />
  )
}
