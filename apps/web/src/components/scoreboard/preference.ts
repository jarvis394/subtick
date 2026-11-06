import { useLocalStorage } from '@/hooks/use-local-storage'

/** Per-browser: match pages open the scoreboard on Detailed instead of Overview. */
export const useDetailedByDefault = () => useLocalStorage('subtick:scoreboard-detailed', false)
