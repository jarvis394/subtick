import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Clapperboard, SearchX } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useDeferredValue, useLayoutEffect, useRef } from 'react'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { EmptyState } from '@/components/empty-state'
import { FadeSwap } from '@/components/fade-swap'
import { HighlightCard } from '@/components/highlight-card'
import { HighlightFilters } from '@/components/highlight-filters'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { useDelayed } from '@/hooks/use-delayed'
import { dayLabel } from '@/lib/format'
import { type ClipListSearch, NO_FILTERS, clipMask, feedFilters } from '@/lib/highlights'
import { EASE_OUT_QUART } from '@/lib/motion'
import { type Clip, clipsQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** How long the first load runs before skeletons show: most finish sooner and never show them. */
const SKELETON_DELAY_MS = 400

/** Stands in for a day of clips: laid out like the heading and cards it's replaced by. */
const HighlightsSkeleton = () => (
  <section aria-hidden>
    <div className="mb-4 flex h-5 items-center">
      <Skeleton className="h-3.5 w-40 rounded" />
    </div>
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-video" />
          <div className="mt-3 flex gap-3">
            <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
            {/* Line boxes the size of the title's (15px) and the meta line's (13px). */}
            <div className="min-w-0 flex-1">
              <div className="flex h-[22.5px] items-center">
                <Skeleton className="h-3.5 w-3/4 rounded" />
              </div>
              <div className="mt-0.5 flex h-[19.5px] items-center">
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)

/** Clips grouped under day headings (by when the match was played). */
const groupByDay = (clips: Clip[]) => {
  const groups: { label: string; clips: Clip[] }[] = []
  for (const clip of clips) {
    const label = dayLabel(clip.playedAt)
    const last = groups.at(-1)
    if (last?.label === label) last.clips.push(clip)
    else groups.push({ label, clips: [clip] })
  }

  return groups
}

/**
 * The clip feed with its filters and viewer, driven by the page's search params (`clipListSearch`).
 * The highlights page shows everyone's; a profile passes `steamId` for one player's.
 */
export const HighlightsFeed = ({ steamId }: { steamId?: string }) => {
  const search: ClipListSearch = useSearch({ strict: false })
  const navigate = useNavigate()

  // The bar answers each click at once; the feed re-renders behind it, interruptibly, so a
  // run of toggles in the Filters popover doesn't wait on every card.
  const feedSearch = useDeferredValue(search)
  const filters = feedFilters(feedSearch, steamId)
  const clips = useInfiniteQuery({ ...clipsQuery(filters), placeholderData: keepPreviousData })
  const items = clips.data?.pages.flatMap((p) => p.items) ?? []
  const filterKey = JSON.stringify(filters)
  const filtered = filterKey !== JSON.stringify(feedFilters({}, steamId))
  // The cards on screen answer old filters until the deferred render catches up and the new clips
  // load: hidden at once under skeletons, so they don't flash before the new view fades in.
  const stale =
    clips.isPlaceholderData || JSON.stringify(feedFilters(search, steamId)) !== filterKey
  // Only the first load is pending; it waits blank ('idle') before its skeletons. Results stay one
  // view across filters, so cards both filters share stay mounted rather than rebuilt.
  const showSkeleton = useDelayed(clips.isPending, SKELETON_DELAY_MS)
  const view = clips.isPending
    ? showSkeleton
      ? 'loading'
      : 'idle'
    : items.length === 0
      ? 'empty'
      : 'results'

  const content = useRef<HTMLElement>(null)
  const settled = useRef({ stale, view })
  const reduce = useReducedMotion()

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- replays a DOM fade when new clips replace stale ones
  useLayoutEffect(() => {
    const prev = settled.current
    settled.current = { stale, view }
    // A new view fades in with the swap (the stale one leaves hidden); one that stays fades here.
    if (!prev.stale || stale || prev.view !== view || reduce) return
    content.current?.animate(
      { opacity: [0, 1] },
      { duration: 250, easing: `cubic-bezier(${EASE_OUT_QUART.join(',')})` },
    )
  }, [stale, view, reduce])

  const update = (patch: Partial<ClipListSearch>) =>
    // The filter sheets lock scrolling; a scroll reset under them jumps the page as they close.
    navigate({ to: '.', search: (s) => ({ ...s, ...patch }), resetScroll: false })

  return (
    <>
      <HighlightFilters search={search} steamId={steamId} onChange={update} />

      <div className="relative">
        {/* In at once, out with the new view's fade-in, so the two crossfade. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-250 ease-out-quart',
            stale ? 'opacity-100 duration-0' : 'opacity-0',
          )}
        >
          <HighlightsSkeleton />
        </div>
        <FadeSwap swapKey={view} appear={false}>
          <div
            // Set only on mount: the view fading out would clear it as it unmounts.
            ref={(el) => {
              if (el) content.current = el
            }}
            className={cn(stale && 'opacity-0')}
          >
            {clips.isPending ? (
              showSkeleton && <HighlightsSkeleton />
            ) : items.length === 0 ? (
              <EmptyState
                icon={filtered ? <SearchX /> : <Clapperboard />}
                title={filtered ? 'Nothing matches these filters' : 'No clips yet'}
                description={
                  filtered
                    ? 'Try removing a filter or two.'
                    : 'The best moments of every match are clipped automatically. They show up here once recorded.'
                }
                action={
                  filtered && (
                    <Button size="sm" onClick={() => update(NO_FILTERS)}>
                      Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid gap-12">
                {groupByDay(items).map((group) => (
                  // Days off screen skip layout and paint, so long feeds scroll and refilter cheaply. The
                  // containment clips paint at the box, so it's padded out to keep the focus rings.
                  <section
                    key={group.label}
                    className="-mx-1 px-1 [contain-intrinsic-size:auto_none_auto_40rem] [content-visibility:auto]"
                  >
                    <h2 className="mb-4 text-body font-medium">
                      {group.label}
                      <span className="text-muted">
                        {' · '}
                        {group.clips.length} {group.clips.length === 1 ? 'clip' : 'clips'}
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                      {group.clips.map((clip) =>
                        clip.clip ? (
                          <HighlightCard
                            key={clip.id}
                            highlight={{ ...clip, clip: clip.clip }}
                            player={clip.player}
                          />
                        ) : null,
                      )}
                    </div>
                  </section>
                ))}
                {clips.hasNextPage && (
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      onClick={() => clips.fetchNextPage()}
                      loading={clips.isFetchingNextPage}
                    >
                      Show more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </FadeSwap>
      </div>

      <ClipViewerDialog
        clipId={search.clip}
        source={filters}
        onSelect={(clip) =>
          navigate({
            to: '.',
            search: (s) => ({ ...s, clip }),
            mask: clipMask(clip),
            replace: true,
            resetScroll: false,
          })
        }
        onClose={() =>
          navigate({ to: '.', search: (s) => ({ ...s, clip: undefined }), resetScroll: false })
        }
      />
    </>
  )
}
