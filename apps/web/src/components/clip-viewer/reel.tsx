import { ScrollArea } from '@base-ui/react/scroll-area'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { IconButton } from '@/components/ui/button'
import { FadeImage } from '@/components/ui/fade-image'
import { Skeleton, Spinner } from '@/components/ui/surface'
import { clipLength, timeAgo } from '@/lib/format'
import { KIND_LABEL } from '@/lib/highlights'
import { cn } from '@/lib/utils'
import type { ReelClip, useReel } from './use-reel'

// From lg up the reel scrolls on its own beside the player; below that it scrolls with the rest.
const ownScroll = () => window.matchMedia('(min-width: 64rem)').matches

export const Reel = ({
  reel,
  activeId,
  position,
  isMatch,
  modal,
  onSelect,
  onPrev,
  onNext,
}: {
  reel: ReturnType<typeof useReel>
  /** Unset at either end of the reel. */
  onPrev?: () => void
  onNext?: () => void
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
  const activeListed = reel.items.some((c) => c.id === activeId)
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- scrolls the list DOM to the playing clip
  useEffect(() => {
    if (!ownScroll() || !activeListed) return
    const el = list.current?.querySelector<HTMLElement>(`[data-clip="${activeId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId, activeListed])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reel
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- IntersectionObserver on the sentinel loads the next page
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
          : // Down to the bottom of the screen, through the page's bottom padding.
            'lg:sticky lg:top-10 lg:-mb-10 lg:max-h-[calc(100dvh-2.5rem)] lg:self-start',
      )}
    >
      <div
        className={cn(
          'mb-2 pb-1 flex items-center gap-2 text-body',
          // Item padding (p-2) lines the heading up with the thumbnails.
          modal && 'mb-2 lg:pb-2 lg:pt-4 lg:pr-5 lg:pl-2',
        )}
      >
        <h2 className="flex-1 font-medium text-muted">
          {isMatch ? 'From this match' : 'More highlights'}
        </h2>
        {position && <span className="text-muted tabular-nums">{position}</span>}
        <div className="flex">
          <IconButton size="sm" label="Previous (K)" disabled={!onPrev} onClick={onPrev}>
            <ChevronUp />
          </IconButton>
          <IconButton size="sm" label="Next (J)" disabled={!onNext} onClick={onNext}>
            <ChevronDown />
          </IconButton>
        </div>
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
          <ol className={cn('grid grid-cols-1 content-start', modal && 'lg:pr-3 lg:pb-3')}>
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
              <li className="px-2 py-6 text-body text-muted">No other clips here.</li>
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
      className="group relative isolate flex w-full cursor-pointer gap-3 rounded-xl p-2 text-left select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
        <span className="absolute right-1 bottom-1 rounded bg-black/65 px-1 py-px font-mono text-micro text-white">
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
        <p className="line-clamp-2 text-small leading-snug font-medium">{clip.title}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-label text-muted">
          <Avatar
            src={clip.player.avatarUrl}
            name={clip.player.name}
            className="size-4 text-micro"
          />
          <span className="truncate">{clip.player.name}</span>
        </p>
        <p className="truncate text-label text-muted">
          {KIND_LABEL[clip.kind]} · R{clip.round}
          {clip.playedAt && ` · ${timeAgo(clip.playedAt)}`}
        </p>
      </div>
    </button>
  </li>
)
