import { summarize, summarizeLobby } from '@subtick/domain'
import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { playerSlug } from '@/components/player-link'
import { Segmented } from '@/components/ui/segmented'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { FormChart } from './form-chart'
import { LobbyCompare } from './lobby-compare'
import { RoundImpact } from './round-impact'

const WINDOWS = [10, 30, 100]
const DEFAULT_WINDOW = 30

const ratingTone = (rating: number) =>
  rating >= 1.15 ? 'text-success' : rating < 0.85 ? 'text-danger' : undefined

/** The windows worth offering: each preset shorter than the history, then all of it. */
const windowsFor = (count: number) => [...new Set([...WINDOWS.filter((w) => w < count), count])]

const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) => (
  <section>
    <h3 className="text-title font-medium">{title}</h3>
    <p className="mb-5 text-small text-muted">{description}</p>
    {children}
  </section>
)

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

/** Form, lobby comparison and round impact over the last N matches, N picked here. */
export const PlayerStats = ({ player }: { player: Player }) => {
  const [picked, setPicked] = useState(DEFAULT_WINDOW)
  const history = player.history
  const options = windowsFor(history.length)
  const size = options.includes(picked) ? picked : options.at(-1)!
  const shown = history.slice(0, size)
  const previous = history.slice(size, size * 2)
  const s = summarize(shown)
  const lobby = summarizeLobby(shown.map((m) => m.lobby))
  const before = previous.length === size ? summarize(previous) : null
  const delta = before && Number((s.rating - before.rating).toFixed(2))

  if (!history.length)
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-body text-muted">
        <BarChart3 className="mx-auto mb-2 size-5" />
        Stats appear here after the first analyzed match.
      </p>
    )

  return (
    <div className="grid grid-cols-1 gap-12">
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-title font-medium">
              {size === 1 ? 'Last match' : `Last ${size} matches`}
            </h2>
            {s.winRate !== null && (
              <p className="text-small text-muted tabular-nums">
                {s.wins} won
                <span aria-hidden className="mx-1.5 text-muted/50">
                  ·
                </span>
                {s.losses} lost
              </p>
            )}
          </div>
          {options.length > 1 && (
            <Segmented
              label="Matches to include"
              value={String(size)}
              options={options.map((o) => ({
                id: String(o),
                label: o === history.length && o !== DEFAULT_WINDOW ? `All ${o}` : `${o}`,
              }))}
              onChange={(next) => setPicked(Number(next))}
            />
          )}
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 @xl:flex @xl:flex-wrap @xl:gap-x-10 @xl:gap-y-4">
          <Readout
            label="Rating"
            value={s.rating.toFixed(2)}
            className={ratingTone(s.rating)}
            note={
              delta !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5',
                    delta > 0 ? 'text-success' : delta < 0 && 'text-danger',
                  )}
                >
                  {delta > 0 ? (
                    <ArrowUp aria-label="Up" className="size-3" />
                  ) : (
                    delta < 0 && <ArrowDown aria-label="Down" className="size-3" />
                  )}
                  {Math.abs(delta).toFixed(2)} from the previous {size}
                </span>
              )
            }
          />
          <Readout
            label="Record"
            value={
              <>
                {s.wins}
                <span className="mx-1.5 font-normal text-foreground/30">/</span>
                {s.losses}
              </>
            }
            note={s.winRate === null ? undefined : `${s.winRate}% won`}
          />
          <Readout
            label="K/D"
            value={s.kd.toFixed(2)}
            note={`${Math.round(s.adr)} damage a round`}
          />
          <Readout label="Headshots" value={`${s.hsPercent}%`} note={`${s.kastPercent}% KAST`} />
        </dl>

        <FormChart key={size} matches={shown} />
      </section>

      <Section
        title="Against the lobby"
        description="Compared with the average of the other players in the same matches."
      >
        <LobbyCompare summary={s} lobby={lobby} />
      </Section>

      <Section
        title="Round impact"
        description={`${s.roundsPlayed} ${s.roundsPlayed === 1 ? 'round' : 'rounds'} overall, split by kills in the round.`}
      >
        <RoundImpact summary={s} highlightsSlug={playerSlug(player)} />
      </Section>
    </div>
  )
}
