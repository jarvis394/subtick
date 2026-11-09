import { splitSessions, summarize, summarizeLobby } from '@subtick/domain'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { FadeSwap } from '@/components/fade-swap'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { type Played, ratingTone } from './facts'
import { SessionSplitChart } from './session-chart'
import { sessionDay, sessionKey, WinLoss } from './session-track'

const SCOPES = [
  { id: 'session', label: 'Session' },
  { id: 'all', label: 'All matches' },
] as const

type Scope = (typeof SCOPES)[number]['id']

const Readout = ({
  label,
  value,
  note,
  noteKey,
  className,
}: {
  label: string
  value: string
  note?: ReactNode
  /** Swaps the note when it changes, since its markup can't be compared. */
  noteKey: string
  className?: string
}) => (
  // The fixed width holds neighbours still when a number's width changes in the row layout.
  <div className="@xl:w-28">
    <dt className="text-small text-muted">{label}</dt>
    <dd className="text-display font-medium tracking-tight tabular-nums">
      <FadeSwap swapKey={value} appear={false}>
        <span className={className}>{value}</span>
      </FadeSwap>
    </dd>
    {note && (
      <dd className="text-caption text-muted tabular-nums">
        <FadeSwap swapKey={noteKey} appear={false}>
          {note}
        </FadeSwap>
      </dd>
    )}
  </div>
)

/** Stats over the latest session or every match, picked here, above the chart split by session. */
export const SplitSessions = ({ history, total }: { history: Played[]; total: number }) => {
  const [view, setView] = useState<{ scope: Scope; openedKey?: string }>({ scope: 'all' })
  const sessions = splitSessions(history)
  const scope = sessions.length > 1 ? view.scope : 'all'
  const opened = sessions.find((session) => sessionKey(session) === view.openedKey)
  const focused = scope === 'session' ? (opened ?? sessions[0]!) : null
  const shown = focused ?? history
  const s = summarize(shown)
  const previous = focused && sessions[sessions.indexOf(focused) + 1]
  const before = previous ? summarize(previous) : null
  const delta = before && Number((s.rating - before.rating).toFixed(2))
  const lobbyRating = summarizeLobby(shown.map((m) => m.lobby)).rating
  const focusKey = focused && sessionKey(focused)
  const lastSessionTitle = opened ? sessionDay(opened) : 'Last session'
  const title = focused ? lastSessionTitle : 'Matches'
  const count = focused ? focused.length : total

  const toggleSession = (key: string) =>
    setView(key === focusKey ? { scope: 'all' } : { scope: 'session', openedKey: key })

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <FadeSwap swapKey={`${title} ${count}`} appear={false}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-title font-medium">{title}</h2>
              <span className="text-title text-muted tabular-nums">{count}</span>
            </div>
          </FadeSwap>
          {scope === 'all' && total > shown.length && (
            <p className="text-caption text-muted">Stats from the latest {shown.length} matches</p>
          )}
        </div>
        {sessions.length > 1 && (
          <Segmented
            label="Matches to include"
            value={scope}
            options={SCOPES}
            onChange={(next) => setView({ scope: next })}
          />
        )}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 @xl:flex @xl:flex-wrap @xl:gap-x-10 @xl:gap-y-4">
        <Readout
          label="Rating"
          value={s.rating.toFixed(2)}
          className={ratingTone(s.rating)}
          noteKey={delta !== null ? delta.toFixed(2) : `~${lobbyRating}`}
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
          noteKey={`${s.wins}-${s.losses}`}
          note={<WinLoss wins={s.wins} losses={s.losses} />}
        />
        <Readout
          label="K/D"
          value={s.kd.toFixed(2)}
          className={ratingTone(s.kd)}
          noteKey={`${Math.round(s.adr)}`}
          note={`${Math.round(s.adr)} ADR`}
        />
        <Readout
          label="Headshots"
          value={`${s.hsPercent}%`}
          noteKey={`${s.kastPercent}`}
          note={`${s.kastPercent}% KAST`}
        />
      </dl>

      <SessionSplitChart
        sessions={sessions}
        focusKey={focusKey}
        onToggleSession={sessions.length > 1 ? toggleSession : undefined}
      />
    </section>
  )
}
