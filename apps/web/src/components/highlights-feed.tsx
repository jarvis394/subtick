import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Clapperboard, SearchX } from 'lucide-react'
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
import { type Clip, clipsQuery } from '@/lib/queries'

/** How long a load runs before skeletons show: most loads finish sooner and never show them. */
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

  const filters = feedFilters(search, steamId)
  const clips = useInfiniteQuery(clipsQuery(filters))
  const items = clips.data?.pages.flatMap((p) => p.items) ?? []
  const showSkeleton = useDelayed(clips.isPending, SKELETON_DELAY_MS)
  const filterKey = JSON.stringify(filters)
  const filtered = filterKey !== JSON.stringify(feedFilters({}, steamId))
  // One view per filter, so switching between cached filters crossfades too. Loading stays a
  // single view: skeletons don't refade when the filter changes again mid-load.
  // Before the delay a load shows nothing ('idle'): the old view fades out and the page waits.
  const view = clips.isPending
    ? showSkeleton
      ? 'loading'
      : 'idle'
    : `${items.length === 0 ? 'empty' : 'results'}:${filterKey}`

  const update = (patch: Partial<ClipListSearch>) =>
    navigate({ to: '.', search: (s) => ({ ...s, ...patch }) })

  return (
    <>
      <HighlightFilters search={search} steamId={steamId} onChange={update} />

      <FadeSwap swapKey={view} appear={false}>
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
      </FadeSwap>

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
