import { useFocusedExpiry } from '@/hooks/use-focused-expiry'
import { NEW_MS, newMatchStamp } from '@/lib/new-matches'
import { cn } from '@/lib/utils'

/** Marks a match that just turned up; collapses and fades away after a few focused seconds. */
export const NewDot = ({ matchId }: { matchId: string }) => {
  const stamp = newMatchStamp(matchId)
  const live = useFocusedExpiry(stamp, NEW_MS)
  if (stamp === undefined) return null
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 transition-[grid-template-columns,opacity] duration-300 ease-out-quart',
        live ? 'grid-cols-[1fr]' : 'grid-cols-[0fr] opacity-0',
      )}
    >
      <span className="min-w-0 overflow-hidden">
        <span className="ml-1.5 block size-1.5 rounded-full bg-link" />
      </span>
    </span>
  )
}
