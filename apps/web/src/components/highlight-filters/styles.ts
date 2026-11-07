import { sheetRowClass } from '@/components/ui/popup-styles'
import { cn } from '@/lib/utils'

/** The bar's dropdown buttons: players and filters. */
export const triggerClass =
  'relative flex h-9 cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3 text-body outline-none select-none transition-colors duration-150 ease-out pointer-fine:hover:bg-surface-2 pointer-coarse:active:bg-surface-2 pointer-coarse:active:duration-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-surface-2'

export const itemClass =
  'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-body outline-none select-none data-highlighted:bg-surface-2'

export const sheetItemClass = cn(sheetRowClass, 'pointer-fine:data-highlighted:bg-surface-2')
