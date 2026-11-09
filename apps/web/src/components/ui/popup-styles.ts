/** The panel menus, popovers and pickers float in on desktop. */
export const popupClass =
  'origin-(--transform-origin) rounded-xl border bg-surface shadow-xl shadow-black/20 outline-none transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100'

/** A row in a bottom sheet, lit at once on a touch press; the caller adds its hover or keyboard highlight. */
export const sheetRowClass =
  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-lead outline-none select-none transition-colors duration-150 ease-out pointer-coarse:active:bg-surface-2 pointer-coarse:active:duration-0'
