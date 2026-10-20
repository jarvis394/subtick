import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import type { HighlightPlayer } from '@/components/highlight-card'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { momentDetails } from '@/components/moment-row'
import { matchQuery } from '@/lib/queries'

/**
 * Whatever `trigger` draws (a "Round 5" button or link) opens the moment's killfeed. The match
 * isn't read until the pointer is near or it's clicked.
 */
export const RoundMoment = ({
  matchId,
  momentId,
  player,
  trigger,
}: {
  matchId: string
  momentId: string
  player: HighlightPlayer
  trigger: (handlers: { onClick: () => void; onPointerEnter: () => void }) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState(false)

  return (
    <>
      {trigger({
        onClick: () => {
          setAsked(true)
          setOpen(true)
        },
        onPointerEnter: () => setAsked(true),
      })}
      {/* Mounted on demand: a page lists many of these, and each observer costs on every render. */}
      {asked && (
        <MomentKillfeed
          matchId={matchId}
          momentId={momentId}
          player={player}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}

const MomentKillfeed = ({
  matchId,
  momentId,
  player,
  open,
  onOpenChange,
}: {
  matchId: string
  momentId: string
  player: HighlightPlayer
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { data } = useQuery(matchQuery(matchId))
  const moment = data?.highlights.find((h) => h.id === momentId)
  if (!data || !moment) return null
  return (
    <KillfeedDialog
      open={open}
      onOpenChange={onOpenChange}
      match={data}
      moment={moment}
      player={player}
      subtitle={momentDetails(moment)}
    />
  )
}
