import { useMediaQuery } from '@/hooks/use-media-query'

/** Phones and tablets: narrow screens, or any touch-first device. They get sheets and larger rows. */
export const useHandheld = () => useMediaQuery('(width < 64rem), (pointer: coarse)')
