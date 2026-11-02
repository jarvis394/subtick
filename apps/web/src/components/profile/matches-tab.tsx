import { useInfiniteQuery } from '@tanstack/react-query'
import { Swords } from 'lucide-react'
import { MatchTable } from '@/components/match-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { playerMatchesQuery } from '@/lib/queries'

export const MatchesTab = ({ steamId }: { steamId: string }) => {
  const matches = useInfiniteQuery(playerMatchesQuery(steamId))
  const items = matches.data?.pages.flatMap((p) => p.items) ?? []

  if (matches.isPending) return <Skeleton className="h-64" />
  if (!items.length)
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-body text-muted">
        <Swords className="mx-auto mb-2 size-5" />
        No analyzed matches yet.
      </p>
    )

  return (
    <div>
      <MatchTable matches={items} />
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
