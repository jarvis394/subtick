import { Dialog } from '@base-ui/react/dialog'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { type HighlightKind, mapName } from '@subtick/domain'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Link2,
  Share2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { MapIcon } from '@/components/map-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button, ButtonLayer, buttonClass } from '@/components/ui/button'
import { FadeImage } from '@/components/ui/fade-image'
import { MorphLabel } from '@/components/ui/morph-label'
import { Badge, Skeleton, Spinner } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { ApiError } from '@/lib/api'
import { clipLength, formatDate, timeAgo } from '@/lib/format'
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
        {/* Base UI's outside-scroll layout: the page stays locked, and the viewport scrolls the
          dialog, which can run past the bottom of the screen. */}
        <Dialog.Viewport className="group/dialog fixed inset-0 z-50">
          <ScrollArea.Root
            style={{ position: undefined }}
            className="h-full group-data-ending-style/dialog:pointer-events-none"
          >
            <ScrollArea.Viewport className="h-full overscroll-contain outline-none group-data-ending-style/dialog:pointer-events-none">
              <ScrollArea.Content className="min-h-full md:px-16 md:pt-12 md:pb-6">
                <Dialog.Popup
                  className={cn(
                    'relative min-h-dvh bg-background outline-none md:min-h-0 md:rounded-2xl md:border md:shadow-2xl lg:mx-auto lg:max-w-7xl',
                    'transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
                    'motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100',
                  )}
                >
                  {/* Stays at the top of the screen while the dialog scrolls under it. */}
                  <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background pr-2 pl-4 md:hidden">
                    <span className="text-[15px] font-medium">Highlights</span>
                    <CloseButton />
                  </header>
                  {shownId && (
                    <ClipViewer
                      id={shownId}
                      source={source}
                      onSelect={onSelect}
                      onClose={onClose}
                    />
                  )}
                </Dialog.Popup>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="z-20 my-1 mr-1 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0"
            >
              <ScrollArea.Thumb className="w-full rounded-full bg-foreground/25" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
          {/* From md up beside the card's top corner, on the backdrop, and held there while the
            dialog scrolls: outside the scroll area. Lines up with the card's right edge, which
            stops moving once the card reaches its max width (80rem plus the 4rem side margins). */}
          <CloseButton className="absolute top-12 right-[calc(1rem+max(0px,(100vw-88rem)/2))] transition-[color,opacity] group-data-ending-style/dialog:opacity-0 group-data-starting-style/dialog:opacity-0 max-md:hidden md:after:-inset-3 md:hover:bg-transparent" />
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The pseudo-element is a hit margin so a slightly-off tap still closes: 10px by default, which
 * fills the phone's 56px bar exactly.
 */
const CloseButton = ({ className }: { className?: string }) => (
  <Dialog.Close
    aria-label="Close"
    className={cn(
      'relative grid size-9 cursor-pointer place-items-center rounded-full text-muted outline-none after:absolute after:-inset-2.5 hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
      // On the backdrop: no fill, just a dimmed icon. A solid gray, not white at partial opacity,
      // which would darken where the X's strokes overlap.
      'transition-colors duration-150',
      className,
    )}
  >
    <X className="size-5" />
  </Dialog.Close>
)

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

  const position =
    index === -1 ? undefined : `${index + 1} of ${reel.items.length}${reel.hasNextPage ? '+' : ''}`

  const reelPanel = (
    <Reel
      reel={reel}
      activeId={id}
      position={position}
      isMatch={'match' in source}
      modal={modal}
      onSelect={onSelect}
    />
  )

  const missing =
    !current &&
    (single.error instanceof ApiError ? single.error.status === 404 : single.isSuccess && !fetched)

  return (
    <div className={cn('grid lg:grid-cols-[minmax(0,1fr)_22rem]', !modal && 'gap-y-8 lg:gap-x-8')}>
      <div className={cn('min-w-0', modal && 'pb-4 md:pb-6')}>
        {!modal && (
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" /> Highlights
          </Link>
        )}

        {missing ? (
          <EmptyState
            icon={<Clapperboard />}
            title="Clip not found"
            description="It may not have been recorded yet, or the link is wrong."
          />
        ) : current ? (
          <Player
            clip={current}
            next={autoplay ? next : undefined}
            onEnded={() => go(next)}
            modal={modal}
            onClose={onClose}
          />
        ) : (
          <div>
            <Skeleton className={cn('aspect-video', modal && VIDEO_FRAME)} />
            <div className={cn(modal && CONTENT_INSET)}>
              <Skeleton className="mt-5 h-7 w-2/3 rounded-lg" />
              <Skeleton className="mt-3 h-5 w-1/2 rounded-lg" />
            </div>
          </div>
        )}

        {current && (
          <div className={cn('mt-5 flex flex-wrap items-center gap-2', modal && CONTENT_INSET)}>
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

      {/* In the dialog the reel is laid over this box, so the player column alone sets the
        height it scrolls in. (On the clip page it's sticky instead, which a wrapper would break.) */}
      {modal ? <div className="relative min-w-0">{reelPanel}</div> : reelPanel}
    </div>
  )
}

/**
 * In the dialog the video runs nearly edge to edge: full-bleed on phones, like the match table, and
 * with a narrower inset than the text below it from md up.
 */
const VIDEO_FRAME = 'md:mx-3 md:mt-3 md:rounded-lg overflow-hidden'
const CONTENT_INSET = 'px-4 md:px-6'

/** Pause after a clip ends before autoplay moves on, so the switch doesn't feel like a cut. */
const AUTOPLAY_DELAY_MS = 1000

const Player = ({
  clip,
  next,
  onEnded,
  modal,
  onClose,
}: {
  clip: ReelClip
  /** The clip autoplay moves to, preloaded once this one is showing. */
  next?: ReelClip
  /** Autoplay's cue; only called while `next` is set. */
  onEnded: () => void
  modal: boolean
  onClose?: () => void
}) => {
  // The dialog's title is the clip's; on the page it is the page heading.
  const Title = modal ? Dialog.Title : 'h1'
  const tags = tagSummary(clip.kills)

  return (
    <div>
      <VideoStage
        clip={clip}
        next={next}
        onEnded={onEnded}
        className={modal ? VIDEO_FRAME : 'rounded-xl'}
      />

      <div className={cn(modal && CONTENT_INSET)}>
        {/* Buttons stay on the first line; a long title wraps beside them. */}
        <div className="mt-5 flex items-start gap-3">
          <Title className="min-w-0 flex-1 text-xl leading-8 font-semibold tracking-tight text-balance">
            {clip.title}
          </Title>
          <ShareActions clip={clip} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar src={clip.player.avatarUrl} name={clip.player.name} className="size-8" />
            <span className="truncate text-[15px] font-medium">{clip.player.name}</span>
          </div>
          <span aria-hidden className="text-border-strong select-none">
            ·
          </span>
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
          <Badge tone="brand">{KIND_LABEL[clip.kind]}</Badge>
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

/** How long a copy confirms itself before going back. */
const COPIED_MS = 1500

/** Says "copied" for a moment after `copy()`; the timer restarts on every copy. */
const useCopied = () => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }
  return { copied, copy }
}

/**
 * Share (the system share sheet where there is one, otherwise a copy) and a copy-link icon button
 * that confirms with a check.
 */
const ShareActions = ({ clip }: { clip: ReelClip }) => {
  const url = `${window.location.origin}/clips/${clip.id}`
  const shareCopy = useCopied()
  const linkCopy = useCopied()
  const canShare = typeof navigator.share === 'function'

  const share = async () => {
    if (!canShare) return shareCopy.copy(url)
    try {
      await navigator.share({ title: clip.title, url })
    } catch (error) {
      // Dismissing the sheet rejects with AbortError; anything else falls back to copying.
      if (!(error instanceof DOMException && error.name === 'AbortError')) shareCopy.copy(url)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => void share()}>
        <Share2 />
        <MorphLabel>{shareCopy.copied ? 'Copied' : 'Share'}</MorphLabel>
      </Button>
      <button
        type="button"
        onClick={() => linkCopy.copy(url)}
        aria-label={linkCopy.copied ? 'Link copied' : 'Copy link'}
        title={linkCopy.copied ? 'Link copied' : 'Copy link'}
        className={buttonClass('secondary', 'icon', 'size-8 rounded-lg')}
      >
        <ButtonLayer />
        <span className="grid place-items-center *:col-start-1 *:row-start-1">
          <Link2
            className={cn(
              'transition-[opacity,scale] duration-150 ease-out',
              linkCopy.copied && 'scale-75 opacity-0',
            )}
          />
          <Check
            className={cn(
              'text-success transition-[opacity,scale] duration-150 ease-out',
              !linkCopy.copied && 'scale-75 opacity-0',
            )}
          />
        </span>
      </button>
    </div>
  )
}

/**
 * The video, crossfading between clips: a new clip's video stacks over the old one and fades in
 * once it has a frame to show, and only then is the old one dropped.
 */
const VideoStage = ({
  clip,
  next,
  onEnded,
  className,
}: {
  clip: ReelClip
  next?: ReelClip
  onEnded: () => void
  className?: string
}) => {
  // The first clip shows at once (its poster stands in); later ones wait for a frame.
  const [layers, setLayers] = useState([{ clip, ready: true }])
  const top = layers.at(-1)!
  // Switching again before the new clip showed replaces it, so the last visible frame stays put.
  if (top.clip.id !== clip.id) setLayers([top.ready ? top : layers[0]!, { clip, ready: false }])

  const dropBelow = (id: string) =>
    setLayers((ls) => ls.slice(ls.findIndex((l) => l.clip.id === id)))
  const markReady = (id: string) => {
    setLayers((ls) => ls.map((l) => (l.clip.id === id ? { ...l, ready: true } : l)))
    // No fade, so no transitionend to wait for.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) dropBelow(id)
  }

  return (
    <div className={cn('relative aspect-video bg-black', className)}>
      {layers.map((layer, i) => (
        <VideoLayer
          key={layer.clip.id}
          clip={layer.clip}
          active={i === layers.length - 1}
          ready={layer.ready}
          onReady={() => markReady(layer.clip.id)}
          onShown={() => dropBelow(layer.clip.id)}
          onEnded={next ? onEnded : undefined}
        />
      ))}
      {/* Warm the next clip so autoplay's switch has a frame to fade to straight away. */}
      {next && top.ready && (
        <video key={next.id} src={next.clip.videoUrl} preload="auto" muted hidden />
      )}
    </div>
  )
}

const VideoLayer = ({
  clip,
  active,
  ready,
  onReady,
  onShown,
  onEnded,
}: {
  clip: ReelClip
  active: boolean
  ready: boolean
  onReady: () => void
  onShown: () => void
  onEnded?: () => void
}) => {
  const video = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)

  // Arriving by click allows sound; a fresh tab may not, so fall back to muted playback.
  useEffect(() => {
    const el = video.current
    if (!el || !active) return
    el.play().catch(() => {
      el.muted = true
      void el.play().catch(() => {})
    })
    return () => el.pause()
  }, [active])

  // Seeking back or pressing play again during the pause cancels the move on.
  const advance = useRef(onEnded)
  advance.current = onEnded
  useEffect(() => {
    if (!ended || !active || !advance.current) return
    const timer = setTimeout(() => advance.current?.(), AUTOPLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ended, active])

  return (
    <video
      ref={video}
      src={clip.clip.videoUrl}
      poster={clip.clip.thumbnailUrl}
      controls={active}
      playsInline
      preload="auto"
      onLoadedData={ready ? undefined : onReady}
      onTransitionEnd={(e) => e.propertyName === 'opacity' && ready && onShown()}
      onEnded={() => setEnded(true)}
      onPlay={() => setEnded(false)}
      onSeeking={() => setEnded(false)}
      className={cn(
        'absolute inset-0 size-full transition-opacity duration-300 ease-out-quart motion-reduce:transition-none',
        ready ? 'opacity-100' : 'opacity-0',
        !active && 'pointer-events-none',
      )}
    />
  )
}

// From lg up the reel scrolls on its own beside the player; below that it scrolls with the rest.
const ownScroll = () => window.matchMedia('(min-width: 64rem)').matches

const Reel = ({
  reel,
  activeId,
  position,
  isMatch,
  modal,
  onSelect,
}: {
  reel: ReturnType<typeof useReel>
  activeId: string
  /** "3 of 12", once the playing clip is found in the reel. */
  position?: string
  isMatch: boolean
  modal: boolean
  onSelect: (id: string) => void
}) => {
  const list = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLLIElement>(null)

  // Keep the playing clip in view as autoplay or the keyboard moves through the reel. Only where
  // the reel scrolls on its own: elsewhere it would scroll the player away.
  useEffect(() => {
    if (!ownScroll()) return
    const el = list.current?.querySelector<HTMLElement>(`[data-clip="${activeId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId, reel.items.length])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reel
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && !isFetchingNextPage && fetchNextPage(),
      { root: ownScroll() ? list.current : null },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <aside
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        modal
          ? // In the dialog it takes the player column's height rather than adding its own: laid
            // over its grid cell (ClipViewer wraps it in a relative box), it never sets the row.
            'px-4 pb-4 md:px-6 md:pb-6 lg:absolute lg:inset-0 lg:p-0'
          : 'lg:sticky lg:top-10 lg:max-h-[calc(100dvh-5rem)] lg:self-start',
      )}
    >
      <div
        className={cn(
          'mb-2 pb-2 flex items-baseline justify-between gap-3 text-sm',
          // Item padding (p-2) lines the heading up with the thumbnails.
          modal && 'mb-2 lg:pb-2 lg:pt-4 lg:pr-5 lg:pl-2',
        )}
      >
        <h2 className="font-medium text-muted">
          {isMatch ? 'From this match' : 'More highlights'}
        </h2>
        {position && <span className="text-muted/70 tabular-nums">{position}</span>}
      </div>
      {/* Scrolls on its own from lg up; below that it is as tall as its clips. */}
      <ScrollArea.Root
        className={cn(
          'relative -mx-2 -mt-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col',
          modal && 'lg:mx-0',
        )}
      >
        {/* A flex child rather than h-full: on the clip page the reel only has a max-height,
          which a percentage height can't resolve against. */}
        <ScrollArea.Viewport
          ref={list}
          // No overscroll containment: a scroll that starts on the reel carries on to the dialog
          // (or page) once the reel has nothing left to scroll, and below lg, where the reel
          // doesn't scroll at all, it goes straight through.
          className="outline-none lg:min-h-0 lg:flex-1"
        >
          {/* One column that may shrink below its content, so long titles truncate instead of
            widening every row past the reel. */}
          <ol className={cn('grid grid-cols-1 content-start gap-1', modal && 'lg:pr-3 lg:pb-3')}>
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
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="z-20 mt-1 mr-1 mb-4 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0"
        >
          <ScrollArea.Thumb className="w-full rounded-full bg-foreground/25" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
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
      className="group relative isolate flex w-full cursor-pointer gap-3 rounded-xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      {/* The card's background is its own layer, so it can scale in on hover and out on leave. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 rounded-[inherit] transition-[scale,opacity,background-color] duration-200 ease-out-quart motion-reduce:scale-100',
          // A press jumps to a stronger fill at once; letting go eases back to the card's own
          // color (the selected fill, or none) at the usual pace.
          'group-active:scale-100 group-active:bg-surface-3 group-active:opacity-100 group-active:duration-0',
          // Touch has no hover phase to grow from: the fill is full size from the start and only
          // fades.
          'pointer-coarse:scale-100',
          active
            ? 'scale-100 bg-surface-2 opacity-100'
            : 'scale-95 bg-surface-2/60 opacity-0 group-hover:scale-100 group-hover:opacity-100',
        )}
      />
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-surface-3">
        <FadeImage
          src={clip.clip.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
        <span className="absolute right-1 bottom-1 rounded bg-black/65 px-1 py-px font-mono text-[10px] text-white">
          {clipLength(clip)}
        </span>
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 bg-black/25 transition-opacity duration-200 ease-out-quart',
            active ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 text-[13px] leading-snug font-medium">{clip.title}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
          <Avatar
            src={clip.player.avatarUrl}
            name={clip.player.name}
            className="size-4 text-[8px]"
          />
          <span className="truncate">{clip.player.name}</span>
        </p>
        <p className="truncate text-[12px] text-muted">
          {KIND_LABEL[clip.kind]} · R{clip.round}
          {clip.playedAt && ` · ${timeAgo(clip.playedAt)}`}
        </p>
      </div>
    </button>
  </li>
)
