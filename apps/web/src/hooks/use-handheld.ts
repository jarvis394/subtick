import { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

/**
 * Phones and tablets: narrow screens, or any touch-first device. They get sheets and larger rows.
 * The `handheld:` and `desktop:` CSS variants match it, for styling without a hook.
 */
export const useHandheld = () => useMediaQuery('(width < 64rem), (pointer: coarse)')

/** Whether a menu opens as a sheet; held while it's open, so crossing the breakpoint doesn't remount it. */
export const useSheetMode = (open: boolean) => {
  const handheld = useHandheld()
  const [held, setHeld] = useState(handheld)
  if (!open && held !== handheld) setHeld(handheld)

  return open ? held : handheld
}
