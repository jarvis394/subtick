import { Clock, Hourglass } from 'lucide-react'
import { useState } from 'react'
import type { ReelSource } from '@/components/clip-viewer'
import { MatchTable } from '@/components/match-table'
import { dayLabel } from '@/lib/format'
import type { Session, SessionPlayer } from '@/lib/queries'
import { sessionAnchor } from '@/lib/sessions'
import { cn } from '@/lib/utils'
import { SessionReel } from './session-reel'
import { SessionRoster } from './session-roster'

const TIME = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })

const length = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const hours = Math.floor(minutes / 60)

  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

/** One half of the record; the side that's ahead takes its color. */
const RecordPart = ({ tone, children }: { tone?: 'success' | 'danger'; children: string }) => (
  <span
    className={cn(
      'flex h-8 -skew-x-12 items-center rounded-md border',
      tone === 'success'
        ? 'border-success/50 bg-success/10 px-6 text-success'
        : tone === 'danger'
          ? 'border-danger/50 bg-danger/10 px-6 text-danger'
          : 'border-border-strong px-3 text-muted',
    )}
  >
    <span className="skew-x-12">{children}</span>
  </span>
)

const Record = ({ wins, losses }: { wins: number; losses: number }) => (
  <span className="flex gap-1 text-body font-medium tabular-nums">
    <RecordPart tone={wins > losses ? 'success' : undefined}>{`${wins}W`}</RecordPart>
    <RecordPart tone={losses > wins ? 'danger' : undefined}>{`${losses}L`}</RecordPart>
  </span>
)

/** Every row of the session, whether or not this player was in it. */
const matchRows = (session: Session, player: SessionPlayer) => {
  const played = new Map(player.played.map((p) => [p.matchId, p]))

  return session.matches.map((m) => {
    const own = played.get(m.id)

    return {
      ...m,
      player: own ? { startingSide: own.startingSide, rank: own.rank, stats: own.stats } : null,
      highlightCount: own?.clips ?? 0,
      absent: !own,
    }
  })
}

/** One sitting of play, seen from whichever party member is picked. */
export const SessionSection = ({
  session,
  onOpenReel,
}: {
  session: Session
  onOpenReel: (source: ReelSource) => void
}) => {
  const [picked, setPicked] = useState(session.players[0]!.steamId)
  const player = session.players.find((p) => p.steamId === picked) ?? session.players[0]!
  const day = dayLabel(session.startedAt)
  const filters = {
    kinds: [] as [],
    steamId: player.steamId,
    matches: session.matches.map((m) => m.id),
  }

  return (
    <section
      id={sessionAnchor(session.id)}
      aria-label={day}
      className="grid scroll-mt-20 grid-cols-1 gap-4 md:scroll-mt-10"
    >
      <header className="flex flex-col items-start gap-x-4 gap-y-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-title font-medium">{day}</h2>
          <Record wins={player.wins} losses={player.losses} />
        </div>
        <p className="flex flex-col items-start gap-2 text-small md:flex-row md:items-center md:gap-4 text-muted tabular-nums [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&_svg]:size-3.5">
          <span>
            <Clock aria-hidden />
            <span className="sr-only">Started at </span>
            {TIME.format(new Date(session.startedAt))}
          </span>
          <span>
            <Hourglass aria-hidden />
            <span className="sr-only">, played for </span>
            {length(session.playedMs)}
          </span>
        </p>
      </header>

      <SessionRoster session={session} selected={player} label={day} onSelect={setPicked} />

      <SessionReel
        key={player.steamId}
        filters={filters}
        count={player.clips}
        onOpen={() => onOpenReel(filters)}
      />

      <MatchTable matches={matchRows(session, player)} />
    </section>
  )
}
