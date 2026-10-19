import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, CircleAlert, CircleStop, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProgressRing, liveProgress } from '@/components/queue-ring'
import { percent, useMatchProgress, useProgressMap } from '@/hooks/use-match-events'
import { type MatchDetail, type QueueItem, queueQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Match = MatchDetail['match']

/** The steps before a match has anything to show, in pipeline order. */
const STEPS = [
  { stage: 'resolving', label: 'Find the demo' },
  { stage: 'downloading', label: 'Download the demo' },
  { stage: 'parsing', label: 'Analyze it' },
] as const
type Stage = (typeof STEPS)[number]['stage']

/** Matches the workers take before this one at its stage. */
const aheadOf = (items: QueueItem[], item: QueueItem) =>
  items.slice(0, items.indexOf(item)).filter((other) => other.stage === item.stage).length

/**
 * What a match shows until its demo is analyzed: where the demo is in the pipeline, live, or why
 * it stopped. Stats, rounds and highlights take its place once the parser is done.
 */
export const MatchProgress = ({ match }: { match: Match }) => {
  if (match.cancelled)
    return (
      <Stopped icon={<CircleStop />} title="Processing stopped">
        Resume it to pick up where it stopped.
      </Stopped>
    )
  if (match.status === 'expired')
    return (
      <Stopped icon={<Clock />} title="Demo no longer available">
        Valve keeps demos for about a month, so this match can't be analyzed anymore.
      </Stopped>
    )
  if (match.status === 'failed')
    return (
      <Stopped icon={<CircleAlert />} title="Couldn't process this demo">
        Something went wrong along the way. Retry to run it again.
      </Stopped>
    )
  return <Steps match={match} />
}

const Steps = ({ match }: { match: Match }) => {
  const { data: queue } = useQuery(queueQuery)
  const items = queue?.items ?? []
  const item = items.find((i) => i.matchId === match.id)
  const streamed = useProgressMap()
  const downloaded = useMatchProgress(match.id, 'downloading')

  // A match waiting in line (or for Valve's upload) is `queued`; its job says which step it's at.
  const stage: Stage =
    match.status === 'resolving' || match.status === 'downloading' || match.status === 'parsing'
      ? match.status
      : item?.stage === 'downloading' || item?.stage === 'parsing'
        ? item.stage
        : 'resolving'
  const current = STEPS.findIndex((s) => s.stage === stage)
  const progress = (item && liveProgress(item, streamed).progress) ?? downloaded
  const running = match.status === stage || item?.state === 'active'

  const detail = (() => {
    if (running) return progress !== undefined ? percent(progress) : 'Working'
    if (!item) return 'Waiting'
    if (item.state === 'delayed')
      return item.stage === 'downloading'
        ? 'Waiting for Valve to upload the demo'
        : 'Retrying shortly'
    const ahead = aheadOf(items, item)
    return ahead ? `${ahead} ${ahead === 1 ? 'match' : 'matches'} ahead` : 'Up next'
  })()

  return (
    <section className="grid gap-4">
      <ol className="overflow-hidden rounded-2xl border bg-surface">
        {STEPS.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'next'
          return (
            <li
              key={step.stage}
              aria-current={state === 'current' ? 'step' : undefined}
              className="relative flex min-h-14 items-center gap-3 border-b px-4 last:border-0"
            >
              <span className="grid size-5 shrink-0 place-items-center">
                {state === 'done' ? (
                  <Check className="size-4 text-success" />
                ) : state === 'current' && running ? (
                  <ProgressRing progress={progress} size={16} className="text-foreground/60" />
                ) : (
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      state === 'current' ? 'bg-foreground/40' : 'bg-foreground/15',
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  state === 'current' ? 'font-medium' : 'text-muted',
                  state === 'next' && 'text-muted/70',
                )}
              >
                {step.label}
              </span>
              <span className="text-[13px] text-muted tabular-nums">
                {state === 'done' ? 'Done' : state === 'current' ? detail : null}
              </span>
              {state === 'current' && running && progress !== undefined && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent transition-[scale] duration-500 ease-out motion-reduce:transition-none"
                  style={{ scale: `${progress} 1` }}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-balance text-muted">
        Rounds, stats and highlights show up here once the demo is analyzed. No need to keep this
        page open: it'll be in your{' '}
        <Link to="/matches" className="link">
          matches
        </Link>
        , and the{' '}
        <Link to="/queue" className="link">
          queue
        </Link>{' '}
        shows everything in line.
      </p>
    </section>
  )
}

const Stopped = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) => (
  <div className="grid justify-items-center rounded-2xl border border-dashed px-6 py-14 text-center">
    <span className="mb-4 grid size-11 place-items-center rounded-xl border bg-surface text-muted [&_svg]:size-5">
      {icon}
    </span>
    <p className="font-serif text-xl">{title}</p>
    <p className="mt-1.5 max-w-sm text-sm text-balance text-muted">{children}</p>
  </div>
)
