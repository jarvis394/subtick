import { splitSessions, summarize, summarizeLobby } from '@subtick/domain'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { type Played, ratingTone } from './facts'
import { SessionSplitChart, WinLoss } from './session-chart'

const SCOPES = [
  { id: 'session', label: 'Session' },
  { id: 'all', label: 'All matches' },
] as const

type Scope = (typeof SCOPES)[number]['id']

const Readout = ({
  label,
  value,
  note,
  className,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  className?: string
}) => (
  <div>
    <dt className="text-small text-muted">{label}</dt>
    <dd className={cn('text-display font-medium tracking-tight tabular-nums', className)}>
      {value}
    </dd>
    {note && <dd className="text-caption text-muted tabular-nums">{note}</dd>}
  </div>
)

/** Stats over the latest session or every match, picked here, above the chart split by session. */
export const SplitSessions = ({ history, total }: { history: Played[]; total: number }) => {
  const [picked, setPicked] = useState<Scope>('all')
  const sessions = splitSessions(history)
  const scope = sessions.length > 1 ? picked : 'all'
  const shown = scope === 'session' ? sessions[0]! : history
  const s = summarize(shown)
  const before = scope === 'session' && sessions[1] ? summarize(sessions[1]) : null
  const delta = before && Number((s.rating - before.rating).toFixed(2))
  const charted = scope === 'session' ? sessions.slice(0, 1) : sessions
  const lobbyRating = summarizeLobby(shown.map((m) => m.lobby)).rating

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-title font-medium">
              {scope === 'session' ? 'Last session' : 'Matches'}
            </h2>
            <span className="text-title text-muted tabular-nums">
              {scope === 'session' ? shown.length : total}
            </span>
          </div>
          {scope === 'all' && total > shown.length && (
            <p className="text-caption text-muted">Stats from the latest {shown.length} matches</p>
          )}
        </div>
        {sessions.length > 1 && (
          <Segmented
            label="Matches to include"
            value={scope}
            options={SCOPES}
            onChange={setPicked}
          />
        )}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 @xl:flex @xl:flex-wrap @xl:gap-x-10 @xl:gap-y-4">
        <Readout
          label="Rating"
          value={s.rating.toFixed(2)}
          className={ratingTone(s.rating)}
          note={
            delta !== null ? (
              <span
                className={cn(
                  'flex items-center gap-0.5',
                  delta > 0 ? 'text-success' : delta < 0 && 'text-danger',
                )}
              >
                {delta > 0 ? (
                  <ArrowUp aria-label="Up" className="size-3" />
                ) : (
                  delta < 0 && <ArrowDown aria-label="Down" className="size-3" />
                )}
                {Math.abs(delta).toFixed(2)}
                <span className="sr-only"> from the previous session</span>
              </span>
            ) : (
              lobbyRating !== null &&
              lobbyRating > 0 && (
                <>
                  <span className="sr-only">Lobby average </span>~{lobbyRating.toFixed(2)}
                </>
              )
            )
          }
        />
        <Readout
          label="Win rate"
          value={s.winRate === null ? '–' : `${s.winRate}%`}
          note={<WinLoss wins={s.wins} losses={s.losses} />}
        />
        <Readout
          label="K/D"
          value={s.kd.toFixed(2)}
          className={ratingTone(s.kd)}
          note={`${Math.round(s.adr)} ADR`}
        />
        <Readout label="Headshots" value={`${s.hsPercent}%`} note={`${s.kastPercent}% KAST`} />
      </dl>

      <SessionSplitChart key={scope} sessions={charted} />
    </section>
  )
}
