import type { PlayerSummary, summarizeLobby } from '@subtick/domain'
import { GapBar } from '@/components/gap-bar'
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
              <GapBar share={Math.abs(gap) / FULL_GAP} better={better} label={change} />
            </dd>
            <dd className="text-right text-muted">{metric.format(theirs)}</dd>
          </div>
        )
      })}
    </dl>
  </div>
)
