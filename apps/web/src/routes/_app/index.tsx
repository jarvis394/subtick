import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HighlightsFeed } from '@/components/highlights-feed'
import { isProcessing } from '@/components/match-status'
import { Spinner } from '@/components/ui/surface'
import { clipListSearch } from '@/lib/highlights'
import { recentMatchesQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/')({
  validateSearch: clipListSearch,
  component: HighlightsPage,
})

function HighlightsPage() {
  const recent = useQuery(recentMatchesQuery)
  const processing = recent.data?.items.filter((m) => isProcessing(m.status)).length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl tracking-tight">Highlights</h1>
        {processing > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
            <Spinner className="size-3" /> Processing {processing}{' '}
            {processing === 1 ? 'match' : 'matches'}
          </p>
        )}
      </div>
      <HighlightsFeed />
    </div>
  )
}
