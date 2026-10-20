import { Tabs } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

/** A small one-of-a-few switch, styled like the kind filter: a pill slides to the active option. */
export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Accessible name for the group. */
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) => (
  <Tabs.Root value={value} onValueChange={(next) => onChange(next as T)} className={className}>
    <Tabs.List
      aria-label={label}
      className="relative flex gap-0.5 rounded-control bg-surface-2/70 p-0.5"
    >
      {options.map((o) => (
        <Tabs.Tab
          key={o.id}
          value={o.id}
          className={cn(
            'relative z-10 h-7 cursor-pointer pointer-coarse:h-9 rounded-lg px-2.5 text-[13px] text-muted outline-none select-none transition-colors',
            'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:text-foreground',
          )}
        >
          {o.label}
        </Tabs.Tab>
      ))}
      <Tabs.Indicator className="absolute top-0 left-0 z-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-lg border bg-surface-3 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
    </Tabs.List>
  </Tabs.Root>
)
