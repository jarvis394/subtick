import { Dialog } from '@base-ui/react/dialog'
import { type HighlightKind, mapName } from '@subtick/domain'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, ChevronUp, Clapperboard, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { MapIcon } from '@/components/map-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton, Spinner } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { ApiError } from '@/lib/api'
import { clipLength, formatDate } from '@/lib/format'
import { KIND_LABEL, tagSummary } from '@/lib/highlights'
import { type Clip, clipQuery, clipsQuery, matchQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

/**
 * What the reel beside the player lists: one match's clips (best first), or the highlights feed
 * under the filters the page has. Either way it shares its cache with the page underneath.
 */
export type ReelSource =
  | { match: string }
  | { kinds: HighlightKind[]; map?: string; mine?: boolean }

/** A clip that has its recording, as the viewer and its reel show it. */
type ReelClip = Clip & { clip: NonNullable<Clip['clip']> }

const recorded = <T extends { clip: Clip['clip'] }>(
  item: T,
): item is T & { clip: NonNullable<Clip['clip']> } => Boolean(item.clip)

const useReel = (source: ReelSource) => {
  const matchId = 'match' in source ? source.match : undefined
  const feed = useInfiniteQuery({
    ...clipsQuery('kinds' in source ? source : {}),
    enabled: !matchId,
  })
  const match = useQuery({ ...matchQuery(matchId ?? ''), enabled: Boolean(matchId) })

  if (matchId) {
    const data = match.data
    const players = new Map(data?.players.map((p) => [p.steamId, p]))
    const items: ReelClip[] = (data?.highlights ?? []).filter(recorded).map((h) => ({
      ...h,
      map: data!.match.map,
      playedAt: data!.match.playedAt ?? data!.match.createdAt,
      player: {
        name: players.get(h.steamId)?.name ?? 'Unknown',
        avatarUrl: players.get(h.steamId)?.avatarUrl ?? null,
      },
    }))
    return {
      items,
      isPending: match.isPending,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    }
  }
  return {
    items: (feed.data?.pages.flatMap((p) => p.items) ?? []).filter(recorded),
    isPending: feed.isPending,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
  }
}

/**
 * The first value seen for `key`, held until the key changes. Clip lists refetch on every pipeline
 * event and come back with freshly presigned URLs; swapping the `<video>` src would restart it.
 */
const useHeld = <T,>(key: string, value: T | undefined) => {
  const [held, setHeld] = useState<{ key: string; value: T } | null>(null)
  if (value !== undefined && held?.key !== key) setHeld({ key, value })
  return held?.key === key ? held.value : value
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * A recorded clip over the page it was opened from, with the rest of that page's clips in a reel
 * beside it. Open while `clipId` is set; the page keeps it in the URL so the view can be shared.
 */
export const ClipViewerDialog = ({
  clipId,
  source,
  onSelect,
  onClose,
}: {
  clipId: string | undefined
  source: ReelSource
  /** Switch to another clip (from the reel, autoplay or the keyboard). */
  onSelect: (id: string) => void
  onClose: () => void
}) => {
  // Keep showing the last clip while the dialog animates out.
  const [shownId, setShownId] = useState(clipId)
  if (clipId && clipId !== shownId) setShownId(clipId)

  return (
    <Dialog.Root open={Boolean(clipId)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background outline-none md:inset-6 md:mx-auto md:max-w-7xl md:rounded-2xl md:border md:shadow-2xl lg:overflow-hidden',
            'transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
            'motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100',
          )}
        >
          {shownId && (
            <ClipViewer id={shownId} source={source} onSelect={onSelect} onClose={onClose} />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The player and its reel. Inside the dialog when `onClose` is given; otherwise laid out as the
 * `/clips/$id` page, which is what a clip's URL opens when loaded directly.
 */
export const ClipViewer = ({
  id,
  source,
  onSelect,
  onClose,
}: {
  id: string
  source: ReelSource
  onSelect: (id: string) => void
  onClose?: () => void
}) => {
  const modal = Boolean(onClose)
  const reel = useReel(source)
  const [autoplay, setAutoplay] = useLocalStorage('subtick:clip-autoplay', true)

  const index = reel.items.findIndex((c) => c.id === id)
  const fromReel = index === -1 ? undefined : reel.items[index]
  // A shared link opens before (or outside of) the reel, so fetch the clip itself then.
  const single = useQuery({ ...clipQuery(id), enabled: !reel.isPending && !fromReel })
  const fetched = single.data && recorded(single.data) ? single.data : undefined
  const current = useHeld(id, fromReel ?? fetched)

  const prev = index > 0 ? reel.items[index - 1] : undefined
  const next = index === -1 ? undefined : reel.items[index + 1]
  const go = (clip: ReelClip | undefined) => clip && onSelect(clip.id)

  // Keep the reel one page ahead of the clip playing.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reel
  const nearEnd = index !== -1 && index >= reel.items.length - 2
  useEffect(() => {
    if (nearEnd && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [nearEnd, hasNextPage, isFetchingNextPage, fetchNextPage])

  const goRef = useRef({ prev: () => go(prev), next: () => go(next) })
  goRef.current = { prev: () => go(prev), next: () => go(next) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key === 'ArrowDown' || e.key === 'j') goRef.current.next()
      else if (e.key === 'ArrowUp' || e.key === 'k') goRef.current.prev()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const missing =
    !current &&
    (single.error instanceof ApiError ? single.error.status === 404 : single.isSuccess && !fetched)

  return (
    <div
      className={cn(
        'grid lg:grid-cols-[minmax(0,1fr)_22rem]',
        modal ? 'lg:h-full' : 'gap-y-8 lg:gap-x-8',
      )}
    >
      <div className={cn('min-w-0', modal && 'p-4 md:p-6 lg:overflow-y-auto')}>
        <div className="mb-4 flex items-center justify-between gap-4">
          {!modal && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" /> Highlights
            </Link>
          )}
          <span className={cn('text-sm text-muted', !modal && 'ml-auto')}>
            {index === -1
              ? ''
              : `${index + 1} of ${reel.items.length}${reel.hasNextPage ? '+' : ''}`}
          </span>
          {modal && (
            <Dialog.Close
              aria-label="Close"
              className="-my-1 -mr-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" />
            </Dialog.Close>
          )}
        </div>

        {missing ? (
          <EmptyState
            icon={<Clapperboard />}
            title="Clip not found"
            description="It may not have been recorded yet, or the link is wrong."
          />
        ) : current ? (
          <Player
            key={current.id}
            clip={current}
            onEnded={() => autoplay && go(next)}
            modal={modal}
            onClose={onClose}
          />
        ) : (
          <div>
            <Skeleton className="aspect-video" />
            <Skeleton className="mt-5 h-7 w-2/3 rounded-lg" />
            <Skeleton className="mt-3 h-5 w-1/2 rounded-lg" />
          </div>
        )}

        {current && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!prev} onClick={() => go(prev)}>
              <ChevronUp /> Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={!next} onClick={() => go(next)}>
              <ChevronDown /> Next
            </Button>
            <Switch checked={autoplay} onCheckedChange={setAutoplay} className="ml-auto">
              Autoplay next
            </Switch>
          </div>
        )}
      </div>

      <Reel
        reel={reel}
        activeId={id}
        isMatch={'match' in source}
        modal={modal}
        onSelect={onSelect}
      />
    </div>
  )
}

const Player = ({
  clip,
  onEnded,
  modal,
  onClose,
}: {
  clip: ReelClip
  onEnded: () => void
  modal: boolean
  onClose?: () => void
}) => {
  // The dialog's title is the clip's; on the page it is the page heading.
  const Title = modal ? Dialog.Title : 'h1'
  const video = useRef<HTMLVideoElement>(null)
  const tags = tagSummary(clip.kills)

  // Arriving by click allows sound; a fresh tab may not, so fall back to muted playback.
  useEffect(() => {
    const el = video.current
    if (!el) return
    el.play().catch(() => {
      el.muted = true
      void el.play().catch(() => {})
    })
  }, [])

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          src={clip.clip.videoUrl}
          poster={clip.clip.thumbnailUrl}
          controls
          playsInline
          preload="auto"
          onEnded={onEnded}
          className="size-full"
        />
      </div>

      <Title className="mt-5 font-serif text-2xl tracking-tight text-balance">{clip.title}</Title>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={clip.player.avatarUrl} name={clip.player.name} className="size-8" />
          <span className="truncate text-[15px] font-medium">{clip.player.name}</span>
        </div>
        <span className="text-border-strong">·</span>
        <Link
          to="/matches/$id"
          params={{ id: clip.matchId }}
          onClick={onClose}
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <MapIcon map={clip.map} className="size-4 rounded-sm text-[8px]" />
          <span className="truncate">
            {mapName(clip.map)} · Round {clip.round}
            {clip.playedAt && ` · ${formatDate(clip.playedAt)}`}
          </span>
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="accent">{KIND_LABEL[clip.kind]}</Badge>
        {tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
    </div>
  )
}

const Reel = ({
  reel,
  activeId,
  isMatch,
  modal,
  onSelect,
}: {
  reel: ReturnType<typeof useReel>
  activeId: string
  isMatch: boolean
  modal: boolean
  onSelect: (id: string) => void
}) => {
  const list = useRef<HTMLOListElement>(null)
  const sentinel = useRef<HTMLLIElement>(null)

  // Keep the playing clip in view as autoplay or the keyboard moves through the reel. Only where
  // the reel scrolls on its own: below the player it would scroll the whole dialog away.
  useEffect(() => {
    if (!window.matchMedia('(min-width: 64rem)').matches) return
    const el = list.current?.querySelector<HTMLElement>(`[data-clip="${activeId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId, reel.items.length])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reel
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && !isFetchingNextPage && fetchNextPage(),
      { root: window.matchMedia('(min-width: 64rem)').matches ? list.current : null },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <aside
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        modal
          ? 'border-t p-4 md:p-6 lg:border-t-0 lg:border-l lg:p-0'
          : 'lg:sticky lg:top-10 lg:max-h-[calc(100dvh-5rem)] lg:self-start',
      )}
    >
      <h2
        className={cn(
          'mb-3 text-sm font-medium text-muted',
          modal && 'lg:mb-0 lg:px-5 lg:pt-6 lg:pb-3',
        )}
      >
        {isMatch ? 'From this match' : 'More highlights'}
      </h2>
      <ol
        ref={list}
        className={cn(
          '-mx-2 grid content-start gap-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain',
          modal && 'lg:mx-0 lg:px-3 lg:pb-4',
        )}
      >
        {reel.isPending &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex gap-3 p-2">
              <Skeleton className="aspect-video w-36 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="mt-2 h-3 w-2/3 rounded" />
              </div>
            </li>
          ))}
        {reel.items.map((clip) => (
          <ReelItem
            key={clip.id}
            clip={clip}
            active={clip.id === activeId}
            onSelect={() => onSelect(clip.id)}
          />
        ))}
        {hasNextPage && (
          <li ref={sentinel} className="flex justify-center py-3 text-muted">
            <Spinner className="size-3.5" />
          </li>
        )}
        {!reel.isPending && reel.items.length === 0 && (
          <li className="px-2 py-6 text-sm text-muted">No other clips here.</li>
        )}
      </ol>
    </aside>
  )
}

const ReelItem = ({
  clip,
  active,
  onSelect,
}: {
  clip: ReelClip
  active: boolean
  onSelect: () => void
}) => (
  <li data-clip={clip.id}>
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group flex w-full cursor-pointer gap-3 rounded-xl p-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
      )}
    >
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-surface-3">
        <img
          src={clip.clip.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
        <span className="absolute right-1 bottom-1 rounded bg-black/65 px-1 py-px font-mono text-[10px] text-white">
          {clipLength(clip)}
        </span>
        {active && (
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-medium tracking-wide text-white uppercase">
            Playing
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p
          className={cn(
            'line-clamp-2 text-[13px] leading-snug font-medium',
            active && 'text-accent',
          )}
        >
          {clip.title}
        </p>
        <p className="mt-1 truncate text-[12px] text-muted">{clip.player.name}</p>
        <p className="truncate text-[12px] text-muted">
          {KIND_LABEL[clip.kind]} · {mapName(clip.map)} · R{clip.round}
        </p>
      </div>
    </button>
  </li>
)
