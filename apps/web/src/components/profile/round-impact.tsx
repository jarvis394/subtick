import type { PlayerSummary } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Greys climb with the kill count; four kills and aces take the game's orange. */
const BANDS = [
  { label: 'No kill', swatch: 'bg-surface-3' },
  { label: '1 kill', swatch: 'bg-foreground/20' },
  { label: '2 kills', swatch: 'bg-foreground/40' },
  { label: '3 kills', swatch: 'bg-foreground/70' },
  { label: '4 kills', swatch: 'bg-brand/60' },
  { label: 'Ace', swatch: 'bg-brand' },
]

const Pair = ({ a, b }: { a: number; b: number }) => (
  <>
    {a}
    <span className="mx-1 font-normal text-foreground/30">/</span>
    {b}
  </>
)

const share = (count: number, total: number) =>
  total ? `${Math.round((count / total) * 100)}%` : '–'

/** Every round played, split by how many kills it brought, then the duels that decide rounds. */
export const RoundImpact = ({
  summary: s,
  highlightsSlug,
}: {
  summary: PlayerSummary
  highlightsSlug: string
}) => {
  const withKills = s.multiKills.reduce((a, b) => a + b, 0)
  const counts = [Math.max(s.roundsPlayed - withKills, 0), ...s.multiKills]
  const facts = [
    {
      label: 'Opening duels',
      value: <Pair a={s.openingKills} b={s.openingDeaths} />,
      note: s.openingWinRate === null ? null : `${s.openingWinRate}% won`,
    },
    {
      label: 'Clutches',
      value: <Pair a={s.clutchesWon} b={s.clutchesAttempted} />,
      note: s.clutchesAttempted ? `${share(s.clutchesWon, s.clutchesAttempted)} won` : null,
    },
    { label: 'Trade kills', value: String(s.tradeKills), note: null },
    {
      label: 'Flash assists',
      value: String(s.flashAssists),
      note: `${s.utilityPerRound} utility damage a round`,
    },
  ]

  return (
    <div>
      <div
        role="img"
        aria-label={BANDS.map((b, i) => `${b.label}: ${counts[i]}`).join(', ')}
        className="flex h-4 gap-0.5 overflow-hidden rounded-md"
      >
        {counts.map((count, i) =>
          count ? (
            <Tooltip
              key={BANDS[i]!.label}
              content={`${BANDS[i]!.label}: ${count} rounds, ${share(count, s.roundsPlayed)}`}
              trigger={
                <span
                  className={cn('h-full min-w-1', BANDS[i]!.swatch)}
                  style={{ flexGrow: count }}
                />
              }
            />
          ) : null,
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        {BANDS.map((band, i) => (
          <div key={band.label}>
            <dt className="flex items-center gap-1.5 text-caption text-muted">
              <span aria-hidden className={cn('size-2 rounded-[2px]', band.swatch)} />
              {band.label}
            </dt>
            <dd
              className={cn(
                'mt-0.5 text-lead font-medium tabular-nums',
                i >= 4 && counts[i] ? 'text-brand-text' : undefined,
              )}
            >
              {counts[i]}
              <span className="ml-1 text-caption font-normal text-muted">
                {share(counts[i]!, s.roundsPlayed)}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <dl className="-mx-4 mt-6 grid grid-cols-2 gap-px overflow-hidden border-y bg-border md:mx-0 md:grid-cols-4 md:rounded-2xl md:border-x">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-surface px-4 py-3 md:px-5">
            <dt className="text-label text-muted">{fact.label}</dt>
            <dd className="mt-0.5 text-lead font-medium tabular-nums">{fact.value}</dd>
            {fact.note && <dd className="text-caption text-muted tabular-nums">{fact.note}</dd>}
          </div>
        ))}
      </dl>

      {s.multiKills[4]! > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 -ml-2"
          render={
            <Link
              to="/players/$player/highlights"
              params={{ player: highlightsSlug }}
              search={{ kind: 'aces' }}
            />
          }
        >
          Ace highlights <ChevronRight />
        </Button>
      )}
    </div>
  )
}
