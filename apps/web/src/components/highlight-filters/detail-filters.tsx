import { Popover } from '@base-ui/react/popover'
import { mapName } from '@subtick/domain'
import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { MapIcon } from '@/components/map-icon'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Badge } from '@/components/ui/surface'
import {
  type ClipListSearch,
  KILL_TAG_LABEL,
  MOMENT_TAG_LABEL,
  detailFilterCount,
  toggled,
} from '@/lib/highlights'
import type { ClipFacets } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { popupClass, triggerClass } from './styles'

type DetailSearch = Pick<ClipListSearch, 'maps' | 'tags' | 'moments' | 'clutch'>

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-2 text-small font-medium">{title}</h3>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </section>
)

/** Maps, tags, moments and clutch sizes, offered only when some clip has them. */
export const DetailFilters = ({
  facets,
  search,
  onChange,
  className,
}: {
  facets?: ClipFacets
  search: DetailSearch
  onChange: (patch: DetailSearch) => void
  /** Layout for the trigger, e.g. joining it to its neighbour. */
  className?: string
}) => {
  const count = detailFilterCount(search)

  return (
    <Popover.Root>
      <Popover.Trigger className={cn(triggerClass, className)}>
        <SlidersHorizontal className="size-4 text-muted" />
        Filters
        {count > 0 && <Badge tone="accent">{count}</Badge>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            className={cn(
              popupClass,
              'grid max-h-(--available-height) w-[min(26rem,calc(100vw-2rem))] gap-5 overflow-auto p-4',
            )}
          >
            <Popover.Title className="sr-only">Filters</Popover.Title>
            {facets?.maps.length ? (
              <Section title="Map">
                {facets.maps.map((map) => (
                  <Chip
                    key={map}
                    pressed={search.maps?.includes(map) ?? false}
                    onPressedChange={() => onChange({ maps: toggled(search.maps, map) })}
                  >
                    <MapIcon map={map} className="-ml-1 size-4 rounded-sm text-micro" />
                    {mapName(map)}
                  </Chip>
                ))}
              </Section>
            ) : null}
            {facets?.tags.length ? (
              <Section title="Kills">
                {facets.tags.map((tag) => (
                  <Chip
                    key={tag}
                    pressed={search.tags?.includes(tag) ?? false}
                    onPressedChange={() => onChange({ tags: toggled(search.tags, tag) })}
                  >
                    {KILL_TAG_LABEL[tag]}
                  </Chip>
                ))}
              </Section>
            ) : null}
            {facets?.moments.length ? (
              <Section title="Moment">
                {facets.moments.map((tag) => (
                  <Chip
                    key={tag}
                    pressed={search.moments?.includes(tag) ?? false}
                    onPressedChange={() => onChange({ moments: toggled(search.moments, tag) })}
                  >
                    {MOMENT_TAG_LABEL[tag]}
                  </Chip>
                ))}
              </Section>
            ) : null}
            {facets?.clutches.length ? (
              <Section title="Clutch">
                {facets.clutches.map((n) => (
                  <Chip
                    key={n}
                    pressed={search.clutch?.includes(n) ?? false}
                    onPressedChange={() => onChange({ clutch: toggled(search.clutch, n) })}
                  >
                    1v{n}
                  </Chip>
                ))}
              </Section>
            ) : null}
            {count > 0 && (
              <div className="-mb-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      maps: undefined,
                      tags: undefined,
                      moments: undefined,
                      clutch: undefined,
                    })
                  }
                >
                  Clear
                </Button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
