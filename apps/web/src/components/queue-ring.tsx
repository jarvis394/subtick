import { ListVideo } from 'lucide-react'
import { matchName } from '@/components/map-icon'
import { type ClipProgress, percent, useProgressMap } from '@/hooks/use-match-events'
import type { QueueItem } from '@/lib/queries'
import { cn } from '@/lib/utils'

/**
 * A circular progress indicator, in the current text color: filled to `progress` (0..1), or a
 * quarter arc sweeping round while the work reports none.
 */
export const ProgressRing = ({
  progress,
  size = 14,
  stroke = 2,
  className,
  trackClassName = 'stroke-foreground/10',
}: {
  progress?: number
  size?: number
  stroke?: number
  className?: string
  trackClassName?: string
}) => {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const sweeping = progress === undefined
  const filled = sweeping ? 0.25 : Math.max(progress, 0.04)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={sweeping ? undefined : Math.floor(progress * 100)}
      style={{ width: size, height: size }}
      className={cn(
        'shrink-0 -rotate-90',
        sweeping && 'animate-spin [animation-duration:1s] motion-reduce:animate-none',
        className,
      )}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className={trackClassName}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - filled)}
        className="stroke-current transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
      />
    </svg>
  )
}

type ProgressMap = ReturnType<typeof useProgressMap>

/**
 * A queue item's progress and current clip: streamed values are fresher than the poll's, which
 * covers the gap after a reload.
 */
export const liveProgress = (item: QueueItem, streamed: ProgressMap) => {
  if (item.state !== 'active') return { progress: undefined, clip: undefined }
  const live = streamed[item.matchId]
  const fresh = live?.status === item.stage ? live : undefined
  const reported = item.moments.find((m) => m.phase)
  const clip: ClipProgress | undefined =
    fresh?.clip ??
    (reported?.phase
      ? { id: reported.id, phase: reported.phase, progress: reported.progress ?? undefined }
      : undefined)

  return { progress: Math.max(fresh?.progress ?? 0, item.progress ?? 0) || undefined, clip }
}

export const useLiveProgress = (item: QueueItem) => liveProgress(item, useProgressMap())

type QueueClip = QueueItem['moments'][number]

/** What a clip is doing now, with the recorder's streamed word on the current one. */
export const clipState = (clip: QueueClip, current: ClipProgress | undefined) => {
  if (clip.state === 'recorded' || clip.state === 'failed') return { state: clip.state }
  if (current?.id === clip.id) return { state: 'recording' as const, phase: current }
  // The recorder moved on to another clip since the last poll.
  if (current) return { state: 'waiting' as const }

  return clip.state === 'recording'
    ? { state: 'recording' as const, phase: { id: clip.id, phase: 'recording' as const } }
    : { state: clip.state }
}

export const phaseLabel = ({ phase, progress }: ClipProgress) =>
  phase === 'loading'
    ? 'Loading demo'
    : phase === 'rendering'
      ? 'Rendering'
      : progress !== undefined
        ? `Recording ${percent(progress)}`
        : 'Recording'

const STAGE_LABELS: Record<QueueItem['stage'], string> = {
  resolving: 'Finding demo',
  downloading: 'Downloading demo',
  parsing: 'Analyzing demo',
  recording: 'Recording',
}

export const stageLabel = (item: QueueItem) =>
  item.stage === 'recording' && item.clips
    ? `Recording ${item.clips} ${item.clips === 1 ? 'clip' : 'clips'}`
    : STAGE_LABELS[item.stage]

/**
 * A running item as what it works on and where it's at: "3K with the M4A1-S" over "Recording 53%",
 * or just "Analyzing demo · 63%" before there are clips.
 */
export const taskLabel = (item: QueueItem, streamed: ProgressMap) => {
  const { progress, clip } = liveProgress(item, streamed)
  const title = clip && item.moments.find((m) => m.id === clip.id)?.title
  if (clip && title) return { title, detail: phaseLabel(clip) }

  return {
    title: undefined,
    detail:
      progress !== undefined
        ? `${STAGE_LABELS[item.stage]} · ${percent(progress)}`
        : STAGE_LABELS[item.stage],
  }
}

/**
 * Work left in the queue: each clip still to record, plus one per match not analyzed yet. A match
 * that only has clips left counts as its clips, not as a match on top of them.
 */
export const remainingWork = (items: QueueItem[]) =>
  items.reduce((sum, item) => sum + (item.stage === 'recording' ? item.clips : 1), 0)

/** One entry per running match for the queue button's tooltip, and how many wait behind them. */
export const useQueueSummary = (items: QueueItem[]) => {
  const streamed = useProgressMap()
  const running = items
    .filter((item) => item.state === 'active')
    .map((item) => ({
      id: item.matchId,
      map: matchName(item.map, item.status),
      ...taskLabel(item, streamed),
    }))

  return { running, waiting: items.length - running.length }
}

/** Running items' progress, averaged; undefined while none of them reports any. */
const useRunningProgress = (items: QueueItem[]) => {
  const streamed = useProgressMap()
  const values = items
    .filter((item) => item.state === 'active')
    .map((item) => liveProgress(item, streamed).progress ?? 0)
  if (values.every((v) => v === 0)) return undefined

  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * The queue button's icon: a ring filled to the running jobs' progress (an empty track while none
 * reports any) around how much work is left.
 */
export const QueueRing = ({ items }: { items: QueueItem[] }) => {
  const progress = useRunningProgress(items)
  const count = remainingWork(items)
  const busy = items.length > 0

  return (
    <span className="relative grid size-5.5 place-items-center *:col-start-1 *:row-start-1">
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
        <ProgressRing
          progress={progress ?? 0}
          size={22}
          stroke={2.5}
          className={cn(
            'size-[22px]!',
            progress === undefined ? 'text-transparent' : 'text-foreground/50',
          )}
          trackClassName="stroke-foreground/10"
        />
        <span className="text-micro leading-none font-semibold text-foreground tabular-nums">
          {count > 9 ? '9+' : count || ''}
        </span>
      </span>
    </span>
  )
}
