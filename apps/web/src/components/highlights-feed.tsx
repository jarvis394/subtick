import { Select } from '@base-ui/react/select'
import { mapName } from '@subtick/domain'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Check, ChevronDown, Clapperboard, SearchX } from 'lucide-react'
import type { z } from 'zod'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { EmptyState } from '@/components/empty-state'
import { FadeSwap } from '@/components/fade-swap'
import { HighlightCard } from '@/components/highlight-card'
import { KindTabs } from '@/components/kind-tabs'
import { MapIcon } from '@/components/map-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { useDelayed } from '@/hooks/use-delayed'
import { dayLabel } from '@/lib/format'
import { KIND_FILTERS, type clipListSearch, clipMask } from '@/lib/highlights'
import { type Clip, clipFacetsQuery, clipsQuery } from '@/lib/queries'

type ClipListSearch = z.infer<typeof clipListSearch>

const ALL_MAPS = '__all'

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
 * The highlights page shows everyone's; a profile passes `steamId` for one player's, where "Only
 * mine" means nothing and is left out.
 */
export const HighlightsFeed = ({ steamId }: { steamId?: string }) => {
  const search: ClipListSearch = useSearch({ strict: false })
  const navigate = useNavigate()
  const update = (patch: Partial<ClipListSearch>) =>
    navigate({ to: '.', search: (s) => ({ ...s, ...patch }) })

  const kind = search.kind ?? 'all'
  const kinds = [...KIND_FILTERS.find((f) => f.id === kind)!.kinds]
  const mine = steamId ? undefined : search.mine
  const filters = { kinds, map: search.map, mine, steamId }

  const clips = useInfiniteQuery(clipsQuery(filters))
  const facets = useQuery(clipFacetsQuery)

  const items = clips.data?.pages.flatMap((p) => p.items) ?? []
  const showSkeleton = useDelayed(clips.isPending, SKELETON_DELAY_MS)
  const filtered = kind !== 'all' || Boolean(search.map) || Boolean(mine)
  // One view per filter, so switching between cached filters crossfades too. Loading stays a
  // single view: skeletons don't refade when the filter changes again mid-load.
  // Before the delay a load shows nothing ('idle'): the old view fades out and the page waits.
  const view = clips.isPending
    ? showSkeleton
      ? 'loading'
      : 'idle'
    : `${items.length === 0 ? 'empty' : 'results'}:${kind}:${search.map ?? ''}:${mine ? 'mine' : ''}`
  const mapItems = [
    { value: ALL_MAPS, label: 'All maps' },
    ...(facets.data?.maps ?? []).map((m) => ({ value: m, label: mapName(m) })),
  ]

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <KindTabs
          value={kind}
          onChange={(value) => update({ kind: value === 'all' ? undefined : value })}
        />

        <Select.Root
          items={mapItems}
          value={search.map ?? ALL_MAPS}
          onValueChange={(value) =>
            update({ map: value === ALL_MAPS || !value ? undefined : String(value) })
          }
        >
          <Select.Trigger className="flex h-9 min-w-36 cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3 text-sm outline-none select-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-surface-2">
            <Select.Value className="flex-1 text-left" />
            <Select.Icon>
              <ChevronDown className="size-4 text-muted" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={6} className="z-50">
              <Select.Popup className="min-w-(--anchor-width) origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
                <Select.List>
                  {mapItems.map((item) => (
                    <Select.Item
                      key={item.value}
                      value={item.value}
                      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md pr-8 pl-2 text-sm outline-none select-none data-highlighted:bg-surface-2"
                    >
                      {item.value === ALL_MAPS ? (
                        <span className="size-5" />
                      ) : (
                        <MapIcon map={item.value} className="size-5 rounded-sm text-[10px]" />
                      )}
                      <Select.ItemText>{item.label}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto">
                        <Check className="size-4 text-accent" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>

        {!steamId && (
          <Switch
            checked={Boolean(search.mine)}
            onCheckedChange={(next) => update({ mine: next || undefined })}
            className="ml-auto"
          >
            Only mine
          </Switch>
        )}
      </div>

      <FadeSwap swapKey={view} appear={false}>
        {clips.isPending ? (
          showSkeleton && <HighlightsSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={filtered ? <SearchX /> : <Clapperboard />}
            title={filtered ? 'Nothing matches these filters' : 'No clips yet'}
            description={
              filtered
                ? `Try another kind or map${mine ? ', or turn off Only mine' : ''}.`
                : 'The best moments of every match are clipped automatically. They show up here once recorded.'
            }
          />
        ) : (
          <div className="grid gap-12">
            {groupByDay(items).map((group) => (
              <section key={group.label}>
                <h2 className="mb-4 text-sm font-medium">
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
