import type { PlayerSummary, summarizeLobby } from '@subtick/domain'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Lobby = ReturnType<typeof summarizeLobby>

/** A gap this large, either way, fills its half of the bar. */
const FULL_GAP = 0.4

const METRICS = [
  { key: 'rating', label: 'Rating', format: (n: number) => n.toFixed(2) },
  { key: 'kd', label: 'K/D', format: (n: number) => n.toFixed(2) },
  { key: 'adr', label: 'ADR', format: (n: number) => String(Math.round(n)) },
  { key: 'kastPercent', label: 'KAST', format: (n: number) => `${n}%` },
  { key: 'hsPercent', label: 'Headshots', format: (n: number) => `${n}%` },
  { key: 'openingWinRate', label: 'Opening duels', format: (n: number) => `${n}%` },
] as const

const GRID =
  'grid grid-cols-[6.5rem_3.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 md:gap-x-4 md:px-5'

/** Each average next to the other players' in the same matches. */
export const LobbyCompare = ({ summary, lobby }: { summary: PlayerSummary; lobby: Lobby }) => (
  // Edge to edge on phones (cancels the page's px-4), a card from md up, like the match table.
  <div className="-mx-4 overflow-hidden border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
    <div className={cn(GRID, 'h-10 border-b text-label font-medium text-muted')}>
      <span />
      <span className="text-right">Player</span>
      <span className="flex justify-between">
        <span>Below</span>
        <span>Above</span>
      </span>
      <span className="text-right">Lobby</span>
    </div>
    <dl className="grid">
      {METRICS.map((metric) => {
        const own = summary[metric.key]
        const theirs = lobby[metric.key]
        if (own === null || theirs === null) return null
        const gap = theirs ? (own - theirs) / theirs : 0
        const reach = Math.min(Math.abs(gap) / FULL_GAP, 1) * 50
        const better = gap >= 0
        const change = `${Math.round(Math.abs(gap) * 100)}% ${better ? 'above' : 'below'} the lobby average`

        return (
          <div
            key={metric.key}
            className={cn(GRID, 'h-12 border-b text-body tabular-nums last:border-0')}
          >
            <dt className="truncate text-muted">{metric.label}</dt>
            <dd className="text-right text-lead font-medium">{metric.format(own)}</dd>
            <dd>
              <Tooltip
                content={change}
                trigger={
                  <span
                    tabIndex={0}
                    aria-label={change}
                    className="relative block h-2 rounded-full bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/30"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-0 rounded-full',
                        better ? 'left-1/2 bg-success/80' : 'right-1/2 bg-danger/70',
                      )}
                      style={{ width: `${Math.max(reach, 1)}%` }}
                    />
                  </span>
                }
              />
            </dd>
            <dd className="text-right text-muted">{metric.format(theirs)}</dd>
          </div>
        )
      })}
    </dl>
  </div>
)
