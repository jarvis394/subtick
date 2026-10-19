import { Tabs } from '@base-ui/react/tabs'
import { KIND_FILTERS, type KindFilter } from '@/lib/highlights'
import { cn } from '@/lib/utils'

/** The All / Aces / Clutches / Multi-kills / Special filter. */
export const KindTabs = ({
  value,
  onChange,
}: {
  value: KindFilter
  onChange: (kind: KindFilter) => void
}) => (
  <Tabs.Root value={value} onValueChange={(next) => onChange(next as KindFilter)}>
    <Tabs.List
      aria-label="Kind"
      className="relative flex flex-wrap gap-1 rounded-control bg-surface-2/70 p-0.5"
    >
      {KIND_FILTERS.map((f) => (
        <Tabs.Tab
          key={f.id}
          value={f.id}
          className={cn(
            'relative z-10 h-8 cursor-pointer pointer-coarse:h-10 rounded-lg px-3 text-sm text-muted outline-none select-none transition-colors',
            'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:text-foreground',
          )}
        >
          {f.label}
        </Tabs.Tab>
      ))}
      {/* Follows top/height too: the filter wraps onto several rows on narrow screens. */}
      <Tabs.Indicator className="absolute top-0 left-0 z-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-lg bg-surface shadow-sm shadow-black/10 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
    </Tabs.List>
  </Tabs.Root>
)
