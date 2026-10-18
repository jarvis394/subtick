import { ListVideo } from 'lucide-react'
import { useProgressMap } from '@/hooks/use-match-events'
import type { QueueItem } from '@/lib/queries'
import { cn } from '@/lib/utils'

const SIZE = 22
const STROKE = 2.5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Running items' progress, averaged; streamed values are fresher than the poll's. */
const useRunningProgress = (items: QueueItem[]) => {
  const streamed = useProgressMap()
  const running = items.filter((item) => item.state === 'active')
  if (!running.length) return { running: false, progress: undefined }
  const values = running.map((item) => {
    const live = streamed[item.matchId]
    return Math.max(live?.status === item.stage ? live.progress : 0, item.progress ?? 0)
  })
  // A stage without progress (analysis) leaves the ring sweeping instead of stuck at 0.
  if (values.every((v) => v === 0)) return { running: true, progress: undefined }
  return { running: true, progress: values.reduce((a, b) => a + b, 0) / values.length }
}

/**
 * The queue button's icon. Idle, the plain queue icon; with work, a ring filled to the running
 * jobs' progress (sweeping while a stage reports none) around how many matches are in line.
 */
export const QueueRing = ({ items }: { items: QueueItem[] }) => {
  const { running, progress } = useRunningProgress(items)
  const busy = items.length > 0
  const sweeping = running && progress === undefined

  return (
    <span className="relative grid size-[22px] place-items-center *:col-start-1 *:row-start-1">
      <ListVideo
        aria-hidden
        className={cn(
          'transition-[opacity,scale] duration-200 ease-out-quart',
          busy && 'scale-75 opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'grid place-items-center *:col-start-1 *:row-start-1',
          'transition-[opacity,scale] duration-200 ease-out-quart',
          !busy && 'scale-75 opacity-0',
        )}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={cn(
            'size-[22px]! -rotate-90',
            sweeping && 'animate-spin [animation-duration:1s] motion-reduce:animate-none',
          )}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-surface-3"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={
              CIRCUMFERENCE * (1 - (sweeping ? 0.25 : running ? Math.max(progress ?? 0, 0.04) : 0))
            }
            className="stroke-accent transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
          />
        </svg>
        <span className="text-[10px] leading-none font-semibold text-foreground tabular-nums">
          {items.length > 9 ? '9+' : items.length || ''}
        </span>
      </span>
    </span>
  )
}
