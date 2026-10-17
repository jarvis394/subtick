import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A labelled on/off toggle; the whole label is the hit target. */
export const Switch = ({
  checked,
  onCheckedChange,
  children,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  className?: string
}) => (
  <label
    className={cn(
      'flex cursor-pointer items-center gap-2 text-[13px] text-muted select-none',
      className,
    )}
  >
    {children}
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative flex h-5 w-9 cursor-pointer rounded-full bg-surface-3 p-0.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-accent"
    >
      <BaseSwitch.Thumb className="size-4 rounded-full bg-white shadow-sm transition-[translate] duration-150 ease-out-quart data-checked:translate-x-4 motion-reduce:transition-none" />
    </BaseSwitch.Root>
  </label>
)
