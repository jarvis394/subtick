import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { LoadFailed } from '@/components/load-failed'
import { MatchTable } from '@/components/match-table'
import { Button } from '@/components/ui/button'
import { MorphLabel } from '@/components/ui/morph-label'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Skeleton } from '@/components/ui/surface'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { useRefreshNotice } from '@/hooks/use-refresh-notice'
import { matchesQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/matches/')({
  head: () => ({ meta: [{ title: 'Matches · subtick' }] }),
  loader: ({ context }) => context.queryClient.prefetchInfiniteQuery(matchesQuery),
  component: MatchesPage,
})

function MatchesPage() {
  const matches = useInfiniteQuery(matchesQuery)
  const items = matches.data?.pages.flatMap((p) => p.items) ?? []
  const refresh = useRefreshMatches()
  const notice = useRefreshNotice(refresh)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-serif text-display tracking-tight">Matches</h1>
        <Button size="sm" variant="secondary" onClick={refresh.mutate} disabled={refresh.isPending}>
          <RefreshIcon spinning={refresh.isPending} />
          <MorphLabel>{notice ?? 'Check for new'}</MorphLabel>
        </Button>
      </div>
      {matches.isPending ? (
        <Skeleton className="h-64" />
      ) : matches.isError && items.length === 0 ? (
        <LoadFailed
          title="Couldn’t load matches"
          onRetry={() => void matches.refetch()}
          retrying={matches.isRefetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Swords />}
          title="No matches yet"
          description="They appear here as soon as Steam reports them."
        />
      ) : (
        <MatchTable matches={items} />
      )}
      {matches.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => matches.fetchNextPage()}
            loading={matches.isFetchingNextPage}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  )
}
