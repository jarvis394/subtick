import { cn } from '@/lib/utils'
import { Tab, Tabs, TabsList } from './tabs'

/** A small one-of-a-few switch: a pill slides to the active option in a track. */
export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'sm',
  className,
}: {
  /** Accessible name for the group. */
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) => (
  <Tabs
    value={value}
    onValueChange={(next) => onChange(next as T)}
    // Shrinks to its container, so a long switch scrolls rather than widening the page.
    className={cn('max-w-full min-w-0', className)}
  >
    <TabsList variant="segmented" size={size} aria-label={label}>
      {options.map((o) => (
        <Tab key={o.id} value={o.id}>
          {o.label}
        </Tab>
      ))}
    </TabsList>
  </Tabs>
)
