import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { type ComponentProps, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'plain' | 'segmented'
type Size = 'sm' | 'md'

const StyleContext = createContext<{ variant: Variant; size: Size }>({
  variant: 'plain',
  size: 'md',
})

/** Base UI's root and panel, unstyled; pair them with `TabsList` and `Tab`. */
export const Tabs = BaseTabs.Root
export const TabsPanel = BaseTabs.Panel

const radius = (variant: Variant, size: Size) =>
  variant === 'plain' && size === 'sm' ? 'rounded-md' : 'rounded-lg'

/**
 * A row of tabs with a pill that slides to the active one. `plain` sits on the page;
 * `segmented` sits in a track. Tabs never wrap or grow on small screens: the row scrolls
 * sideways instead.
 */
export const TabsList = ({
  variant = 'plain',
  size = 'md',
  className,
  children,
  ...props
}: ComponentProps<typeof BaseTabs.List> & { variant?: Variant; size?: Size }) => (
  <StyleContext.Provider value={{ variant, size }}>
    <BaseTabs.List
      className={cn(
        'relative flex max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        variant === 'segmented' ? 'w-fit gap-0.5 rounded-control bg-surface-2/70 p-0.5' : 'gap-1',
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        className={cn(
          'absolute top-0 left-0 z-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none',
          variant === 'segmented' ? 'border bg-surface-3' : 'bg-surface-2',
          radius(variant, size),
        )}
      />
    </BaseTabs.List>
  </StyleContext.Provider>
)

export const Tab = ({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) => {
  const { variant, size } = useContext(StyleContext)
  return (
    <BaseTabs.Tab
      className={cn(
        'relative z-10 flex shrink-0 cursor-pointer items-center whitespace-nowrap text-muted outline-none select-none transition-colors',
        // Inset, so the scrolling row doesn't clip the ring.
        'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-active:text-foreground',
        size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-sm',
        radius(variant, size),
        className,
      )}
      {...props}
    />
  )
}
