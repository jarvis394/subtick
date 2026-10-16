import { Select } from '@base-ui/react/select'
import { mapName } from '@subtick/domain'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown } from 'lucide-react'
import { z } from 'zod'
import { HighlightCard } from '@/components/highlight-card'
import { MapIcon } from '@/components/map-icon'
import { isProcessing } from '@/components/match-status'
import { Button } from '@/components/ui/button'
import { Skeleton, Spinner } from '@/components/ui/surface'
import { dayLabel } from '@/lib/format'
import { KIND_FILTERS, type KindFilter } from '@/lib/highlights'
import { type Clip, clipFacetsQuery, clipsQuery, recentMatchesQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

const Search = z.object({
  kind: z.enum(KIND_FILTERS.map((f) => f.id) as [KindFilter, ...KindFilter[]]).optional(),
  map: z.string().optional(),
})

export const Route = createFileRoute('/_app/')({
  validateSearch: Search,
  component: HighlightsPage,
})

const ALL_MAPS = '__all'

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

function HighlightsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const kind = search.kind ?? 'all'
  const kinds = [...KIND_FILTERS.find((f) => f.id === kind)!.kinds]

  const clips = useInfiniteQuery(clipsQuery({ kinds, map: search.map }))
  const facets = useQuery(clipFacetsQuery)
  const recent = useQuery(recentMatchesQuery)
  const processing = recent.data?.items.filter((m) => isProcessing(m.status)).length ?? 0

  const items = clips.data?.pages.flatMap((p) => p.items) ?? []
  const filtered = kind !== 'all' || Boolean(search.map)
  const mapItems = [
    { value: ALL_MAPS, label: 'All maps' },
    ...(facets.data?.maps ?? []).map((m) => ({ value: m, label: mapName(m) })),
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl tracking-tight">Highlights</h1>
        {processing > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
            <Spinner className="size-3" /> Processing {processing}{' '}
            {processing === 1 ? 'match' : 'matches'}
          </p>
        )}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Kind"
          className="flex flex-wrap gap-1 rounded-[10px] bg-surface-2/70 p-0.5"
        >
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={kind === f.id}
              onClick={() =>
                navigate({ search: (s) => ({ ...s, kind: f.id === 'all' ? undefined : f.id }) })
              }
              className={cn(
                'h-8 cursor-pointer rounded-lg px-3 text-sm text-muted outline-none select-none transition-colors',
                'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                'aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm aria-pressed:shadow-black/10',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Select.Root
          items={mapItems}
          value={search.map ?? ALL_MAPS}
          onValueChange={(value) =>
            navigate({
              search: (s) => ({
                ...s,
                map: value === ALL_MAPS || !value ? undefined : String(value),
              }),
            })
          }
        >
          <Select.Trigger className="flex h-9 min-w-36 cursor-pointer items-center gap-2 rounded-[10px] border border-border-strong px-3 text-sm outline-none select-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-surface-2">
            <Select.Value className="flex-1 text-left" />
            <Select.Icon>
              <ChevronDown className="size-4 text-muted" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={6} className="z-50">
              <Select.Popup className="min-w-(--anchor-width) origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
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
      </div>

      {clips.isPending ? (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="font-serif text-xl">
            {filtered ? 'Nothing matches these filters' : 'No clips yet'}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            {filtered
              ? 'Try another kind or map.'
              : 'Your best moments are clipped automatically after each match. They show up here once recorded.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-12">
          {groupByDay(items).map((group) => (
            <section key={group.label}>
              <h2 className="mb-4 text-sm font-medium text-muted">{group.label}</h2>
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
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
                disabled={clips.isFetchingNextPage}
              >
                {clips.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
