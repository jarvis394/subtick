import { RadioGroup } from '@base-ui/react/radio-group'
import type { Session, SessionPlayer } from '@/lib/queries'
import { PlayerCard } from './player-card'

/** The party, at most five: picks whose point of view the session shows. */
export const SessionRoster = ({
  session,
  selected,
  label,
  onSelect,
}: {
  session: Session
  selected: SessionPlayer
  label: string
  onSelect: (steamId: string) => void
}) => (
  <RadioGroup
    aria-label={`Whose point of view to show for ${label}`}
    value={selected.steamId}
    onValueChange={(value) => onSelect(value as string)}
    className="-mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4 py-0.5 [scrollbar-width:none]"
  >
    {session.players.map((player) => (
      <PlayerCard key={player.steamId} session={session} player={player} />
    ))}
  </RadioGroup>
)
