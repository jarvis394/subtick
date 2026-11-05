import { Popover } from '@base-ui/react/popover'
import { mapName } from '@subtick/domain'
import { SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useState } from 'react'
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
import { EASE_OUT_EXPO } from '@/lib/motion'
import type { ClipFacets } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { popupClass, triggerClass } from './styles'

const hidden = { width: 0, marginLeft: -8, opacity: 0, scale: 0.9, filter: 'blur(2px)' }

// The new number comes from the side it's heading: up as filters add, down as they clear.
const digitMotion = {
  from: (dir: number) => ({ y: dir * 8, opacity: 0, filter: 'blur(2px)' }),
  in: { y: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.3, ease: EASE_OUT_EXPO } },
  out: (dir: number) => ({
    y: dir * -8,
    opacity: 0,
    filter: 'blur(2px)',
    transition: { duration: 0.15, ease: EASE_OUT_EXPO },
  }),
}

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
  // Keeps the last number while the badge leaves, so it doesn't tick to 0 on the way out.
  const [shown, setShown] = useState({ count, dir: 1 })
  if (count > 0 && shown.count !== count) setShown({ count, dir: count > shown.count ? 1 : -1 })

  return (
    <Popover.Root>
      <Popover.Trigger className={cn(triggerClass, className)}>
        <SlidersHorizontal className="size-4 text-muted" />
        Filters
        {/* The trigger's width eases while the badge fades in over it, unclipped; the pull swallows
          the trigger's gap while it's hidden. */}
        <AnimatePresence initial={false}>
          {count > 0 && (
            <motion.span
              key="count"
              initial={hidden}
              animate={{
                width: 'auto',
                marginLeft: 0,
                opacity: 1,
                scale: 1,
                filter: 'blur(0px)',
                transition: { duration: 0.35, ease: EASE_OUT_EXPO },
              }}
              exit={{ ...hidden, transition: { duration: 0.2, ease: EASE_OUT_EXPO } }}
              className="flex shrink-0 origin-left"
            >
              <Badge
                tone="overlay-inverse"
                className="relative shrink-0 overflow-hidden tabular-nums"
              >
                <AnimatePresence initial={false} mode="popLayout" custom={shown.dir}>
                  <motion.span
                    key={shown.count}
                    custom={shown.dir}
                    variants={digitMotion}
                    initial="from"
                    animate="in"
                    exit="out"
                  >
                    {shown.count}
                  </motion.span>
                </AnimatePresence>
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
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
