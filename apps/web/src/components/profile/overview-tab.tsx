import { mapName } from '@subtick/domain'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { HighlightCard } from '@/components/highlight-card'
import { MapIcon } from '@/components/map-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import { type Player, clipsQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

const ratingTone = (rating: number) =>
  rating >= 1.15 ? 'text-success' : rating < 0.85 ? 'text-danger' : undefined

const Stat = ({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) => (
  <div>
    <dt className="text-small text-muted">{label}</dt>
    <dd className={cn('mt-1 text-section font-medium tabular-nums', className)}>{value}</dd>
  </div>
)

/**
 * One column per match, oldest to newest: a bar rising from 1.00 (above is a good game, below a
 * rough one), then the map and the rating under it. Scrolls sideways rather than squeezing when
 * there are more matches than room.
 */
const FormChart = ({ form }: { form: Player['form'] }) => {
  const max = Math.max(2, ...form.map((m) => m.rating))
  const height = 64
  const baseline = height - (1 / max) * height

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        className="relative flex w-max min-w-full gap-1"
        role="list"
        aria-label="Rating by match"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-border-strong"
          style={{ top: baseline }}
        />
        {form.map((m) => (
          <div
            key={m.matchId}
            role="listitem"
            className="flex min-w-8 flex-1 flex-col items-center"
          >
            <div className="flex h-16 w-full items-end">
              <Tooltip
                content={
                  <span className="tabular-nums">
                    {mapName(m.map)}, {m.rating.toFixed(2)}
                    {m.result && <span className="text-muted"> · {RESULT[m.result]}</span>}
                  </span>
                }
                trigger={
                  <Link
                    to="/matches/$id"
                    params={{ id: m.matchId }}
                    aria-label={`${mapName(m.map)}, rating ${m.rating.toFixed(2)}`}
                    className={cn(
                      'w-full rounded-[3px] outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring',
                      m.result === 'win'
                        ? 'bg-success/80'
                        : m.result === 'loss'
                          ? 'bg-danger/70'
                          : 'bg-surface-3',
                    )}
                    style={{ height: `${Math.max((m.rating / max) * 100, 4)}%` }}
                  />
                }
              />
            </div>
            <MapIcon map={m.map} className="mt-2 size-4 rounded-sm text-micro" />
            <span className={cn('mt-1 text-micro text-muted tabular-nums', ratingTone(m.rating))}>
              {m.rating.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RESULT = { win: 'Won', loss: 'Lost', draw: 'Draw' } as const

/** Enough to fill two rows of three, or three of two. */
const PREVIEW_CLIPS = 6

export const OverviewTab = ({ player }: { player: Player }) => {
  const s = player.summary
  const clips = useInfiniteQuery(clipsQuery({ kinds: [], steamId: player.steamId }))

  return (
    <div className="grid grid-cols-1 gap-10">
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-lead font-medium">
            Last {s.matches} {s.matches === 1 ? 'match' : 'matches'}
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
        <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
          <Stat label="Rating" value={s.rating.toFixed(2)} className={ratingTone(s.rating)} />
          <Stat label="Win rate" value={s.winRate === null ? '–' : `${s.winRate}%`} />
          <Stat label="K/D" value={s.kd.toFixed(2)} />
          <Stat label="ADR" value={String(Math.round(s.adr))} />
          <Stat label="HS%" value={`${s.hsPercent}%`} />
          <Stat label="KAST" value={`${s.kastPercent}%`} />
        </dl>
        {player.form.length > 1 && (
          <div className="mt-8">
            <FormChart form={player.form} />
          </div>
        )}
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          {[
            ['Opening duels won', s.openingWinRate === null ? '–' : `${s.openingWinRate}%`],
            ['Clutches won', `${s.clutchesWon} of ${s.clutchesAttempted}`],
            ['Aces', String(s.aces)],
            ['4-kill rounds', String(s.fourKs)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="text-label text-muted">{label}</dt>
              <dd className="mt-0.5 text-lead font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="mb-4 flex h-8 items-center justify-between gap-4">
          <h2 className="text-lead font-medium">Recent highlights</h2>
          {player.clipCount > PREVIEW_CLIPS && (
            <Button
              size="sm"
              variant="ghost"
              render={
                <Link to="/players/$steamId/highlights" params={{ steamId: player.steamId }} />
              }
            >
              All {player.clipCount} clips <ChevronRight />
            </Button>
          )}
        </div>
        {clips.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: PREVIEW_CLIPS }, (_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : player.clipCount === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-body text-muted">
            No recorded clips yet. Aces, clutches and multi-kills show up here once recorded.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {(clips.data?.pages[0]?.items ?? [])
              .slice(0, PREVIEW_CLIPS)
              .map((clip) =>
                clip.clip ? (
                  <HighlightCard
                    key={clip.id}
                    highlight={{ ...clip, clip: clip.clip }}
                    player={clip.player}
                  />
                ) : null,
              )}
          </div>
        )}
      </section>
    </div>
  )
}
