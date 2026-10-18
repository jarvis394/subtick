import { mapName } from '@subtick/domain'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, CircleAlert, Clock, ListVideo, Sparkles, X } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { FadeSwap } from '@/components/fade-swap'
import { MapIcon } from '@/components/map-icon'
import { MomentBadge } from '@/components/moment-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, ButtonLayer, buttonClass } from '@/components/ui/button'
import { Collapse, Presence, usePresence } from '@/components/ui/presence'
import { Badge, Skeleton, Spinner } from '@/components/ui/surface'
import { useCancelMatch, useCancelMoment } from '@/hooks/use-match-actions'
import { percent, useMatchProgress } from '@/hooks/use-match-events'
import { clipLength, shortAge } from '@/lib/format'
import { type QueueItem, queueQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/queue')({
  loader: ({ context }) => void context.queryClient.prefetchQuery(queueQuery),
  component: QueuePage,
})

const STAGE_LABELS: Record<QueueItem['stage'], string> = {
  resolving: 'Finding demo',
  downloading: 'Downloading demo',
  parsing: 'Analyzing demo',
  recording: 'Recording',
}

const stageLabel = (item: QueueItem) =>
  item.stage === 'recording' && item.clips
    ? `Recording ${item.clips} ${item.clips === 1 ? 'clip' : 'clips'}`
    : STAGE_LABELS[item.stage]

function QueuePage() {
  const { data, isError, refetch } = useQuery(queueQuery)
  const items = data?.items ?? []
  const running = items.filter((item) => item.state === 'active')
  const waiting = items.filter((item) => item.state !== 'active')

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Queue</h1>
        <p className="mt-1.5 text-sm text-muted">
          Matches being downloaded, analyzed and recorded on this instance.
        </p>
      </div>
      <FadeSwap swapKey={data ? (items.length ? 'items' : 'empty') : isError ? 'error' : 'loading'}>
        {data ? (
          items.length === 0 ? (
            <EmptyState
              icon={<ListVideo />}
              title="Nothing in the queue"
              description="New matches show up here while they're processed, then land in Highlights."
            />
          ) : (
            <div className="grid">
              <Presence show={running.length > 0}>
                <Group title="Running" items={running} className="pb-8" />
              </Presence>
              <Presence show={waiting.length > 0}>
                <Group title="Up next" items={waiting} numbered />
              </Presence>
            </div>
          )
        ) : isError ? (
          <div className="grid justify-items-center rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Couldn't load the queue</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <Skeleton className="h-48 rounded-2xl" />
        )}
      </FadeSwap>
    </div>
  )
}

const Group = ({
  title,
  items,
  numbered,
  className,
}: {
  title: string
  items: QueueItem[]
  numbered?: boolean
  className?: string
}) => {
  // Finished and cancelled matches collapse out instead of the list jumping.
  const rows = usePresence(items, (item) => item.matchId)
  return (
    <section className={cn('min-w-0', className)}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        {title}
        <span className="text-muted/60 tabular-nums">{items.length}</span>
      </h2>
      {/* Flex, not grid: a leaving card's negative margin can then cancel its gap. */}
      <div role="list" className="flex flex-col gap-4">
        {rows.map(({ key, item, exiting, entering }) => (
          <Collapse key={key} exiting={exiting} entering={entering} className="-mt-4">
            <div className="pt-4">
              <div className="rounded-2xl border">
                <QueueRow
                  item={item}
                  position={numbered && !exiting ? items.indexOf(item) + 1 : undefined}
                />
                <Presence show={item.moments.length > 0}>
                  <ClipGroups item={item} />
                </Presence>
              </div>
            </div>
          </Collapse>
        ))}
      </div>
    </section>
  )
}

const QueueRow = ({ item, position }: { item: QueueItem; position?: number }) => {
  const cancel = useCancelMatch()
  // Streamed progress is fresher than the poll; the job's own value covers the gap after a reload.
  const streamed = useMatchProgress(item.matchId, item.stage)
  const progress =
    item.state === 'active' ? Math.max(streamed ?? 0, item.progress ?? 0) || undefined : undefined

  const detail =
    item.state === 'active'
      ? progress !== undefined
        ? percent(progress)
        : 'Working'
      : item.state === 'delayed'
        ? item.stage === 'downloading'
          ? 'Waiting for Valve to upload the demo'
          : 'Retrying shortly'
        : `Queued ${shortAge(item.queuedAt)} ago`

  return (
    <div
      role="listitem"
      className={cn(
        'relative flex min-h-16 items-center gap-3 pr-3',
        'transition-opacity duration-150 ease-out',
        cancel.isPending && 'opacity-50',
      )}
    >
      <Link
        to="/matches/$id"
        params={{ id: item.matchId }}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {position !== undefined && (
          <span className="w-4 shrink-0 text-right font-mono text-[12px] text-muted/60 tabular-nums">
            {position}
          </span>
        )}
        <MapIcon map={item.map} className="size-9 shrink-0 rounded-lg text-[14px]" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{mapName(item.map)}</span>
            <span className="shrink-0 text-[12px] text-muted/70 tabular-nums">
              {shortAge(item.playedAt)}
            </span>
            {item.mine && <Badge className="shrink-0">Yours</Badge>}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
            {item.state === 'active' && <Spinner className="size-2.5 border-[1.5px] text-accent" />}
            <span className="truncate">
              {stageLabel(item)} · <span className="tabular-nums">{detail}</span>
            </span>
          </p>
        </div>
      </Link>
      {item.canCancel && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => cancel.mutate(item.matchId)}
          disabled={cancel.isPending}
          aria-label={`Cancel ${mapName(item.map)}`}
        >
          <X /> <span className="max-sm:hidden">Cancel</span>
        </Button>
      )}
      {item.state === 'active' && (
        <ProgressBar progress={progress} className="absolute inset-x-0 bottom-0 md:inset-x-4" />
      )}
    </div>
  )
}

/** A hairline along the row's bottom edge: filled to the stage's progress, or sweeping without. */
const ProgressBar = ({ progress, className }: { progress?: number; className?: string }) => (
  <div aria-hidden className={cn('h-0.5 overflow-hidden rounded-full', className)}>
    {progress !== undefined ? (
      <div
        className="h-full origin-left rounded-full bg-accent transition-[scale] duration-500 ease-out motion-reduce:transition-none"
        style={{ scale: `${progress} 1` }}
      />
    ) : (
      <div className="h-full w-1/3 animate-[queue-sweep_1.4s_linear_infinite] rounded-full bg-accent/60 motion-reduce:animate-none" />
    )}
  </div>
)

type QueueClip = QueueItem['moments'][number]

const requesterRank = (m: QueueClip) => (m.requester?.isViewer ? 0 : m.requester ? 1 : 2)

/** The viewer's own requests first, then other people's by name, then subtick's own picks. */
const byRequester = (moments: QueueClip[]) => {
  const groups = Map.groupBy(moments, (m) => m.requester?.id ?? '')
  return [...groups.values()].toSorted((a, b) => {
    return (
      requesterRank(a[0]!) - requesterRank(b[0]!) ||
      (a[0]!.requester?.name ?? '').localeCompare(b[0]!.requester?.name ?? '')
    )
  })
}

/**
 * Once a match is analyzed and recording, its card opens up to show the clips being recorded,
 * under who asked for them.
 */
const ClipGroups = ({ item }: { item: QueueItem }) => {
  // A group whose last clip was cancelled collapses out with it.
  const groups = usePresence(byRequester(item.moments), (g) => g[0]!.requester?.id ?? 'auto')
  return (
    // Flex, not grid: a leaving group's negative margin can then cancel its gap.
    <div className="flex flex-col gap-4 border-t p-3 sm:p-4">
      {groups.map(({ key, item: group, exiting, entering }) => {
        const requester = group[0]!.requester
        return (
          <Collapse key={key} exiting={exiting} entering={entering} className="-mt-4">
            <section className="min-w-0 pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-[12px] font-medium text-muted">
                {requester ? (
                  <Avatar src={requester.image} name={requester.name} className="size-5" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-surface-2">
                    <Sparkles className="size-3" />
                  </span>
                )}
                {requester
                  ? `Requested by ${requester.isViewer ? 'you' : requester.name}`
                  : 'Picked automatically'}
              </h3>
              <ClipList matchId={item.matchId} moments={group} />
            </section>
          </Collapse>
        )
      })}
    </div>
  )
}

const ClipList = ({ matchId, moments }: { matchId: string; moments: QueueClip[] }) => {
  // Cancelled clips collapse out of the grid.
  const entries = usePresence(moments, (m) => m.id)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(({ key, item, exiting, entering }) => (
        <Collapse key={key} exiting={exiting} entering={entering}>
          <QueueClipCard matchId={matchId} clip={item} />
        </Collapse>
      ))}
    </div>
  )
}

const CLIP_STATUS: Record<QueueClip['state'], { label: string; className: string }> = {
  recorded: { label: 'Done', className: 'text-success' },
  recording: { label: 'Recording', className: 'text-accent' },
  waiting: { label: 'Waiting', className: 'text-muted' },
  failed: { label: 'Failed', className: 'text-danger' },
}

/** A clip of a recording match: who made the play, what it is, and where recording is at. */
const QueueClipCard = ({ matchId, clip }: { matchId: string; clip: QueueClip }) => {
  const cancel = useCancelMoment(matchId)
  const status = CLIP_STATUS[clip.state]

  return (
    <div
      className={cn(
        'flex min-h-14 min-w-0 items-center gap-3 rounded-xl border py-2 pr-2 pl-2.5',
        'transition-[background-color,border-color,opacity] duration-200 ease-out',
        // The one being recorded right now stands out; finished ones step back.
        clip.state === 'recording' && 'border-accent/45 bg-accent/6',
        clip.state === 'recorded' && 'opacity-70',
      )}
    >
      <Avatar src={clip.player.avatarUrl} name={clip.player.name} className="size-8" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium">{clip.title}</p>
          <MomentBadge moment={clip} className="w-auto shrink-0" />
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {clip.player.name} · Round {clip.round} · {clipLength(clip)}
        </p>
      </div>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1.5 text-[12px] font-medium',
          status.className,
        )}
        title={status.label}
      >
        {clip.state === 'recording' ? (
          <Spinner className="size-3 border-[1.5px]" />
        ) : clip.state === 'recorded' ? (
          <Check className="size-3.5" />
        ) : clip.state === 'failed' ? (
          <CircleAlert className="size-3.5" />
        ) : (
          <Clock className="size-3.5" />
        )}
        {/* Phones show the icon alone, leaving the title room. */}
        <span className="max-sm:sr-only">{status.label}</span>
      </span>
      {clip.canCancel && (
        <button
          type="button"
          onClick={() => cancel.mutate(clip.id)}
          disabled={cancel.isPending}
          aria-label={`Cancel recording ${clip.title}`}
          title="Cancel recording"
          className={buttonClass('ghost', 'icon', 'size-7 rounded-lg [&_svg]:size-3.5')}
        >
          <ButtonLayer />
          <X />
        </button>
      )}
    </div>
  )
}
