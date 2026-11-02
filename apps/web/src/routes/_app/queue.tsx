import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, CircleAlert, Clock, ListVideo, Sparkles, X } from 'lucide-react'
import { createContext, use, useState } from 'react'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { EmptyState } from '@/components/empty-state'
import { FadeSwap } from '@/components/fade-swap'
import { MapIcon, matchName } from '@/components/map-icon'
import { MomentBadge } from '@/components/moment-badge'
import { type MomentTarget, QueueMomentDialog } from '@/components/queue-moment-dialog'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { AutoHeight, FadeItem, FadeList, Presence } from '@/components/ui/presence'
import {
  ProgressRing,
  clipState,
  phaseLabel,
  stageLabel,
  useLiveProgress,
} from '@/components/queue-ring'
import { Badge, Skeleton } from '@/components/ui/surface'
import { useCancelMatch, useCancelMoment } from '@/hooks/use-match-actions'
import { type ClipProgress, percent } from '@/hooks/use-match-events'
import { clipLength, shortAge } from '@/lib/format'
import { type QueueItem, matchQuery, queueQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/queue')({
  loader: ({ context }) => void context.queryClient.prefetchQuery(queueQuery),
  component: QueuePage,
})

/** Opens a clip card: its recording once it has one, its moment otherwise. */
const OpenClip = createContext<(matchId: string, clip: QueueClip) => void>(() => {})

function QueuePage() {
  const { data, isError, refetch } = useQuery(queueQuery)
  // The match stays after closing, so the viewer's reel keeps its source while it animates out.
  const [viewing, setViewing] = useState<{ matchId: string; clipId?: string }>({ matchId: '' })
  const [inspecting, setInspecting] = useState<MomentTarget | null>(null)

  const openClip = (matchId: string, clip: QueueClip) =>
    clip.state === 'recorded'
      ? setViewing({ matchId, clipId: clip.id })
      : setInspecting({ matchId, momentId: clip.id })

  return (
    <OpenClip value={openClip}>
      <QueueBody
        data={data}
        isError={isError}
        refetch={refetch}
        recordingAhead={(item) => aheadInLine(data?.items ?? [], item)}
      />
      <ClipViewerDialog
        clipId={viewing.clipId}
        source={{ match: viewing.matchId }}
        onSelect={(clipId) => setViewing((v) => ({ ...v, clipId }))}
        onClose={() => setViewing((v) => ({ matchId: v.matchId }))}
      />
      <QueueMomentDialog target={inspecting} onClose={() => setInspecting(null)} />
    </OpenClip>
  )
}

/** Matches the recorders take before this one: recording work earlier in line. */
const aheadInLine = (items: QueueItem[], item: QueueItem) =>
  items.slice(0, items.indexOf(item)).filter((other) => other.stage === 'recording').length

const QueueBody = ({
  data,
  isError,
  refetch,
  recordingAhead,
}: {
  data: { items: QueueItem[] } | undefined
  isError: boolean
  refetch: () => unknown
  recordingAhead: (item: QueueItem) => number
}) => {
  const items = data?.items ?? []
  const running = items.filter((item) => item.state === 'active')
  const waiting = items.filter((item) => item.state !== 'active')

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="font-serif text-display tracking-tight">Queue</h1>
        <p className="mt-1.5 text-body text-muted">
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
                <Group
                  title="Running"
                  items={running}
                  recordingAhead={recordingAhead}
                  className="pb-8"
                />
              </Presence>
              <Presence show={waiting.length > 0}>
                <Group title="Up next" items={waiting} recordingAhead={recordingAhead} />
              </Presence>
            </div>
          )
        ) : isError ? (
          <div className="grid justify-items-center rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="text-body font-medium">Couldn't load the queue</p>
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
  recordingAhead,
  className,
}: {
  title: string
  items: QueueItem[]
  recordingAhead: (item: QueueItem) => number
  className?: string
}) => {
  // Finished and cancelled matches fade out and the rest slide up, instead of the list jumping.
  return (
    <section className={cn('min-w-0', className)}>
      <h2 className="mb-2 flex items-center gap-2 text-body font-medium text-muted">
        {title}
        <span className="text-muted/60 tabular-nums">{items.length}</span>
      </h2>
      {/* Eases to its new height, so the group below slides instead of jumping. */}
      <AutoHeight>
        <div role="list" className="flex flex-col gap-4">
          <FadeList>
            {items.map((item) => (
              <FadeItem key={item.matchId}>
                {/* Its border eases to the new height as clips come and go. */}
                {/* With clips at the bottom, its bottom corners = the clip cards' radius (12px) + the
                    padding around them, so the corners nest. */}
                <AutoHeight
                  className={cn(
                    'rounded-2xl border transition-[border-radius] duration-300 ease-out-quart',
                    item.moments.length > 0 && 'rounded-b-3xl sm:rounded-b-[28px]',
                    // Phones give the card the screen's width, edge to edge (past main's px-4).
                    'max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0',
                  )}
                >
                  <QueueRow item={item} />
                  <Presence show={item.moments.length > 0}>
                    <ClipGroups item={item} ahead={recordingAhead(item)} />
                  </Presence>
                </AutoHeight>
              </FadeItem>
            ))}
          </FadeList>
        </div>
      </AutoHeight>
    </section>
  )
}

const QueueRow = ({ item }: { item: QueueItem }) => {
  const cancel = useCancelMatch()
  const { progress } = useLiveProgress(item)

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
        <MapIcon map={item.map} className="size-9 shrink-0 rounded-lg text-body" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-medium">
              {matchName(item.map, item.status)}
            </span>
            <span className="shrink-0 text-label text-muted/70 tabular-nums">
              {shortAge(item.playedAt)}
            </span>
            {item.mine && <Badge className="shrink-0">Yours</Badge>}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-label text-muted">
            {item.state === 'active' && (
              <ProgressRing progress={progress} size={12} className="text-foreground/50" />
            )}
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
          loading={cancel.isPending}
          aria-label={`Cancel ${matchName(item.map, item.status)}`}
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
const ClipGroups = ({ item, ahead }: { item: QueueItem; ahead: number }) => {
  const { clip: current } = useLiveProgress(item)

  /** What a waiting clip waits for: a recorder, its turn, or its batch's clips. */
  const waitingFor = (clip: QueueClip) => {
    if (item.state === 'delayed') return 'Retrying shortly'
    if (item.state !== 'active') return ahead ? 'Up next' : 'Waiting for recorder'
    const before = item.moments
      .slice(0, item.moments.indexOf(clip))
      .filter((m) => m.state === 'waiting' || m.state === 'recording').length

    return before <= 1 ? 'Up next' : `After ${before} clips`
  }

  // A group whose last clip was cancelled fades out with it.
  return (
    <div className="flex flex-col gap-4 border-t p-3 sm:p-4">
      <FadeList>
        {byRequester(item.moments).map((group) => {
          const requester = group[0]!.requester

          return (
            <FadeItem key={requester?.id ?? 'auto'}>
              <section className="min-w-0">
                <h3 className="mb-2 flex items-center gap-2 text-label font-medium text-muted">
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
                <ClipList
                  matchId={item.matchId}
                  moments={group}
                  current={current}
                  waitingFor={waitingFor}
                />
              </section>
            </FadeItem>
          )
        })}
      </FadeList>
    </div>
  )
}

const ClipList = ({
  matchId,
  moments,
  current,
  waitingFor,
}: {
  matchId: string
  moments: QueueClip[]
  current?: ClipProgress
  waitingFor: (clip: QueueClip) => string
}) => {
  // Cancelled clips fade out of the grid.
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FadeList>
        {moments.map((item) => (
          <FadeItem key={item.id}>
            <QueueClipCard
              matchId={matchId}
              clip={item}
              current={current}
              waitingFor={waitingFor(item)}
            />
          </FadeItem>
        ))}
      </FadeList>
    </div>
  )
}

/** A clip of a recording match: who made the play, what it is, and where recording is at. */
const QueueClipCard = ({
  matchId,
  clip,
  current,
  waitingFor,
}: {
  matchId: string
  clip: QueueClip
  current?: ClipProgress
  waitingFor: string
}) => {
  const cancel = useCancelMoment(matchId)
  const queryClient = useQueryClient()
  const open = use(OpenClip)
  const { state, phase } = clipState(clip, current)

  return (
    <div
      className={cn(
        'relative flex min-w-0 items-start rounded-xl border',
        'transition-[background-color,border-color,opacity] duration-200 ease-out',
        // Lit while the pointer is anywhere on the card, its cancel button included.
        'hover:bg-surface-2/60',
        // Finished clips step back.
        state === 'recorded' && 'opacity-70 hover:opacity-100',
      )}
    >
      <button
        type="button"
        onClick={() => open(matchId, clip)}
        // The dialog reads the match; start on it before the click lands.
        onPointerEnter={() => void queryClient.prefetchQuery(matchQuery(matchId))}
        aria-label={state === 'recorded' ? `Watch ${clip.title}` : `Show ${clip.title}`}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl py-2.5 pr-2 pl-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar src={clip.player.avatarUrl} name={clip.player.name} className="mt-0.5 size-8" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-small font-medium">{clip.title}</p>
            <MomentBadge moment={clip} className="w-auto shrink-0" />
          </div>
          <p className="mt-0.5 truncate text-label text-muted">
            {clip.player.name} · Round {clip.round} · {clipLength(clip)}
          </p>
          <ClipStatus state={state} phase={phase} waitingFor={waitingFor} />
        </div>
      </button>
      {clip.canCancel && (
        <IconButton
          size="xs"
          label="Cancel recording"
          aria-label={`Cancel recording ${clip.title}`}
          onClick={() => cancel.mutate(clip.id)}
          loading={cancel.isPending}
          className="mt-2 mr-2"
        >
          <X />
        </IconButton>
      )}
    </div>
  )
}

/** The clip's third line: waiting, done, failed, or the recorder's phase with its progress. */
const ClipStatus = ({
  state,
  phase,
  waitingFor,
}: {
  state: QueueClip['state']
  phase?: ClipProgress
  waitingFor: string
}) => (
  <p
    className={cn(
      'mt-1.5 flex min-w-0 items-center gap-1.5 text-label font-medium',
      state === 'recording'
        ? 'text-foreground'
        : state === 'recorded'
          ? 'text-success'
          : state === 'failed'
            ? 'text-danger'
            : 'text-muted',
    )}
  >
    {state === 'recording' ? (
      <ProgressRing
        // Loading and encoding report no frames: the ring sweeps.
        progress={phase?.phase === 'recording' ? phase.progress : undefined}
        size={12}
        className="text-foreground/50"
      />
    ) : state === 'recorded' ? (
      <Check className="size-3.5" />
    ) : state === 'failed' ? (
      <CircleAlert className="size-3.5" />
    ) : (
      <Clock className="size-3.5" />
    )}
    <span className="truncate tabular-nums">
      {state === 'recording' && phase
        ? phaseLabel(phase)
        : state === 'recorded'
          ? 'Done'
          : state === 'failed'
            ? 'Failed'
            : waitingFor}
    </span>
    {/* The reason is long and technical; the card opens it. */}
    {state === 'failed' && <span className="shrink-0 font-normal text-muted">· See why</span>}
  </p>
)
