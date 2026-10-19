import { useFocusedExpiry } from '@/hooks/use-focused-expiry'
import type { useRefreshMatches } from '@/hooks/use-match-actions'

const NOTICE_MS = 5000

/** What a finished refresh found, for a few focused seconds after it; null the rest of the time. */
export const useRefreshNotice = (refresh: ReturnType<typeof useRefreshMatches>) => {
  const result = refresh.data
  const live = useFocusedExpiry(result?.at, NOTICE_MS)
  if (!live || !result) return null
  if (result.newMatches === 0) return result.done ? 'Up to date' : 'Still looking…'
  return `${result.newMatches} new ${result.newMatches === 1 ? 'match' : 'matches'}`
}
