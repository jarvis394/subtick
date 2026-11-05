import { ScrollArea } from '@base-ui/react/scroll-area'
import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { MapIcon } from '@/components/map-icon'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/format'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Played = Player['history'][number]

const RESULT = { win: 'Won', loss: 'Lost', draw: 'Draw' } as const

const BAR = {
  win: 'bg-success/75 hover:bg-success',
  loss: 'bg-danger/65 hover:bg-danger',
  draw: 'bg-foreground/25 hover:bg-foreground/40',
}

const ratingTone = (rating: number) =>
  rating >= 1.15 ? 'text-success' : rating < 0.85 ? 'text-danger' : 'text-muted'

/** Opens on the newest matches, at the right end. */
const scrollToEnd = (viewport: HTMLDivElement | null) => {
  if (viewport) viewport.scrollLeft = viewport.scrollWidth
}

const MatchTip = ({ m }: { m: Played }) => (
  <span className="grid gap-0.5 tabular-nums">
    <span className="font-medium">
      {mapName(m.map)}
      {m.result && <span className="font-normal text-muted"> · {RESULT[m.result]}</span>}
    </span>
    <span>
      {m.stats.rating.toFixed(2)} rating · {m.stats.kills}
      <span className="mx-0.5 text-foreground/30">/</span>
      {m.stats.deaths} · {Math.round(m.stats.adr)} ADR
    </span>
    <span className="text-muted">{formatDate(m.playedAt)}</span>
  </span>
)

/**
 * One column per match, oldest to newest: a bar rising from 0 with a dashed line at 1.00, then the
 * map and the rating under it. Scrolls sideways rather than squeezing, opening on the newest.
 */
export const FormChart = ({ matches }: { matches: Played[] }) => {
  const ordered = matches.toReversed()
  const max = Math.max(2, ...ordered.map((m) => m.stats.rating))

  // Like the scoreboard: the scroller bleeds 1rem into the page gutter, so bars scroll out past
  // the content edge instead of being cut at it, with a Base UI scrollbar in the padding below.
  return (
    <figure>
      <ScrollArea.Root
        className={cn(
          'relative -mx-4 data-has-overflow-x:pb-2',
          // An eased fade (ease-out alpha stops), so the edge has no visible band.
          '[--fade:var(--color-surface),color-mix(in_oklab,var(--color-surface)_74%,transparent)_19%,color-mix(in_oklab,var(--color-surface)_54%,transparent)_34%,color-mix(in_oklab,var(--color-surface)_38%,transparent)_47%,color-mix(in_oklab,var(--color-surface)_19%,transparent)_65%,color-mix(in_oklab,var(--color-surface)_8%,transparent)_80%,color-mix(in_oklab,var(--color-surface)_2%,transparent)_91%,transparent]',
        )}
      >
        <ScrollArea.Viewport ref={scrollToEnd} className="overscroll-x-contain">
          <ScrollArea.Content className="px-4 pt-1 pb-1">
            <div className="w-max min-w-full">
              <div role="list" aria-label="Rating by match, oldest first" className="flex gap-1">
                {ordered.map((m) => (
                  <div
                    key={m.matchId}
                    role="listitem"
                    className="flex min-w-8 flex-1 flex-col items-center"
                  >
                    <div className="flex h-32 w-full items-end md:h-44">
                      <Tooltip
                        content={<MatchTip m={m} />}
                        trigger={
                          <Link
                            to="/matches/$id"
                            params={{ id: m.matchId }}
                            aria-label={`${mapName(m.map)}, rating ${m.stats.rating.toFixed(2)}${m.result ? `, ${RESULT[m.result].toLowerCase()}` : ''}`}
                            className={cn(
                              'w-full rounded-[3px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                              BAR[m.result ?? 'draw'],
                            )}
                            style={{ height: `${Math.max((m.stats.rating / max) * 100, 3)}%` }}
                          />
                        }
                      />
                    </div>
                    <MapIcon map={m.map} className="mt-2 size-4 rounded-sm text-micro" />
                    <span
                      className={cn('mt-1 text-micro tabular-nums', ratingTone(m.stats.rating))}
                    >
                      {m.stats.rating.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        {/* Over the viewport, not inside it, so the line and its label stay put while bars scroll. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1 h-32 md:h-44">
          <div
            className="absolute inset-x-0 border-t border-dashed border-foreground/30"
            style={{ bottom: `${(1 / max) * 100}%` }}
          >
            <span className="absolute right-4 bottom-1 rounded-sm bg-surface px-1 text-micro text-muted tabular-nums">
              1.00
            </span>
          </div>
        </div>
        {/* Bars fade into the gutter the scroller bleeds into, rather than cut at the screen. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-4 bg-[linear-gradient(to_right,var(--fade))] md:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-4 bg-[linear-gradient(to_left,var(--fade))] md:block"
        />
        <ScrollArea.Scrollbar
          orientation="horizontal"
          className={cn(
            'absolute bottom-0 mx-4 flex h-1.5 items-center rounded-full bg-foreground/[0.04]',
            'opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100',
            'motion-reduce:transition-none',
          )}
        >
          <ScrollArea.Thumb className="h-full rounded-full bg-foreground/20 transition-colors hover:bg-foreground/30 active:bg-foreground/40" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </figure>
  )
}
