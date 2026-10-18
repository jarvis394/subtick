import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RotateCw, Swords } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { MatchTable } from '@/components/match-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { matchesQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/matches/')({
  loader: ({ context }) => context.queryClient.prefetchInfiniteQuery(matchesQuery),
  component: MatchesPage,
})

function MatchesPage() {
  const matches = useInfiniteQuery(matchesQuery)
  const items = matches.data?.pages.flatMap((p) => p.items) ?? []
  const refresh = useRefreshMatches()

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl tracking-tight">Matches</h1>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="disabled:opacity-100"
        >
          <RotateCw
            className={cn(refresh.isPending && 'animate-spin [animation-duration:600ms]')}
          />
          Check for new
        </Button>
      </div>
      {matches.isPending ? (
        <Skeleton className="h-64" />
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
            disabled={matches.isFetchingNextPage}
          >
            {matches.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      )}
    </div>
  )
}
