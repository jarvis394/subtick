import type { PerformanceComparison, PerformanceLevel, PerformanceMetric } from '@subtick/domain'
import { GapBar } from '@/components/gap-bar'
import { cn } from '@/lib/utils'

/** Standard deviations that fill one half of the bar. */
const FULL_Z = 2

const METRICS: Record<PerformanceMetric, { label: string; format: (n: number) => string }> = {
  impact: { label: 'Impact', format: (n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}` },
  aim: { label: 'Aim', format: (n) => String(Math.round(n)) },
  rating: { label: 'Rating', format: (n) => n.toFixed(2) },
  kd: { label: 'K/D', format: (n) => n.toFixed(2) },
  adr: { label: 'ADR', format: (n) => String(Math.round(n)) },
  kast: { label: 'KAST', format: (n) => `${Math.round(n)}%` },
}

const LEVELS: Record<PerformanceLevel, string> = {
  'well-above': 'Well above your usual',
  above: 'Above your usual',
  typical: 'About your usual',
  below: 'Below your usual',
  'well-below': 'Well below your usual',
}

const GRID =
  'grid grid-cols-[6.5rem_3.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 md:gap-x-4 md:px-5'

/** The viewer's numbers in this match next to the median of their earlier matches. */
export const MatchPerformance = ({ comparison }: { comparison: PerformanceComparison }) => {
  const sample = comparison[0]?.matches ?? 0

  return (
    <section className="min-w-0">
      <h2 className="mb-1 font-display text-heading tracking-tight">Against your usual</h2>
      <p className="mb-4 text-small text-muted">Median of your previous {sample} matches</p>
      {/* Edge to edge on phones (cancels the page's px-4), a card from md up. */}
      <div className="-mx-4 overflow-hidden border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
        <div className={cn(GRID, 'h-10 border-b text-label font-medium text-muted')}>
          <span />
          <span className="text-right">Match</span>
          <span className="flex justify-between">
            <span>Below</span>
            <span>Above</span>
          </span>
          <span className="text-right">Usual</span>
        </div>
        <dl className="grid">
          {comparison.map((c) => {
            const { label, format } = METRICS[c.metric]
            const better = c.delta >= 0

            return (
              <div
                key={c.metric}
                className={cn(GRID, 'h-12 border-b text-body tabular-nums last:border-0')}
              >
                <dt className="truncate text-muted">{label}</dt>
                <dd className="text-right text-lead font-medium">{format(c.value)}</dd>
                <dd>
                  <GapBar share={Math.abs(c.z) / FULL_Z} better={better} label={LEVELS[c.level]} />
                </dd>
                <dd className="text-right text-muted">{format(c.baseline)}</dd>
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
