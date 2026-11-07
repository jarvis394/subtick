import { useQuery } from '@tanstack/react-query'
import { Swords } from 'lucide-react'
import { FadeSwap } from '@/components/fade-swap'
import { Button, IconButton } from '@/components/ui/button'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Skeleton } from '@/components/ui/surface'
import { useDelayed } from '@/hooks/use-delayed'
import { useHandheld } from '@/hooks/use-handheld'
import { useRefreshMatches } from '@/hooks/use-match-actions'
import { useRefreshNotice } from '@/hooks/use-refresh-notice'
import { recentMatchesQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { RecentRow, fade, usePendingPath } from './rows'

const SKELETON_WIDTHS = ['w-14', 'w-16', 'w-12', 'w-16', 'w-14']

export const Recents = ({
  collapsed,
  setUp,
  onNavigate,
  viewTransition,
}: {
  collapsed: boolean
  setUp: boolean
  onNavigate?: () => void
  viewTransition?: boolean
}) => {
  const handheld = useHandheld()
  const { data: recent, isError: recentFailed, refetch, isFetching } = useQuery(recentMatchesQuery)
  const pendingPath = usePendingPath()
  // Nothing until a load has run a while: most finish sooner and never show the skeleton.
  const showSkeleton = useDelayed(!recent && !recentFailed, 400)
  const refresh = useRefreshMatches()
  const notice = useRefreshNotice(refresh)

  return (
    <div className={cn('mt-5', handheld ? 'px-1.5' : 'px-2')}>
      <div className={cn('flex h-7 items-center', handheld ? 'pr-1.5 pl-3' : 'pr-1 pl-2.75')}>
        <FadeSwap className={cn('flex-1', fade(collapsed))} swapKey={notice ? 'notice' : 'title'}>
          {notice ? (
            <p className="text-label font-medium whitespace-nowrap text-link">{notice}</p>
          ) : (
            <p className="text-label font-medium whitespace-nowrap text-muted/70">Recents</p>
          )}
        </FadeSwap>
        {setUp && (
          <IconButton
            size="xs"
            label="Check for new matches"
            onClick={refresh.mutate}
            disabled={refresh.isPending}
            className={cn(
              'transition-[color,translate] duration-200 ease-out-quart motion-reduce:transition-none',
              // In the rail it slides over the map icons' column, centered on x = 28px: the
              // content stays w-64, so from 216px in (8px padding plus pr-1, or 6px plus pr-1.5 handheld) to 14px is 202px.
              collapsed && '-translate-x-50.5',
            )}
          >
            <RefreshIcon spinning={refresh.isPending} />
          </IconButton>
        )}
      </div>
      <FadeSwap
        swapKey={recent ? 'ready' : recentFailed ? 'failed' : showSkeleton ? 'loading' : 'idle'}
      >
        {recent ? (
          <>
            {recent.items.length === 0 && (
              <div
                className={cn(
                  'grid justify-items-center rounded-xl border border-dashed px-4 py-6 text-center',
                  fade(collapsed),
                )}
              >
                <span className="mb-3 grid size-9 place-items-center rounded-lg border bg-surface text-muted">
                  <Swords className="size-4" />
                </span>
                <p className="text-small font-medium">No matches yet</p>
                <p className="mt-1 text-label text-balance text-muted">
                  {setUp
                    ? 'Matches you play show up here.'
                    : 'Finish setup to start picking up your matches.'}
                </p>
              </div>
            )}
            <div className="grid">
              {recent.items.map((match) => (
                <RecentRow
                  key={match.id}
                  match={match}
                  collapsed={collapsed}
                  pending={pendingPath === `/matches/${match.id}`}
                  onNavigate={onNavigate}
                  viewTransition={viewTransition}
                />
              ))}
            </div>
          </>
        ) : recentFailed ? (
          // Without this a failed request (after its retries) would leave the skeleton up forever.
          <div
            className={cn(
              'grid justify-items-center rounded-xl border border-dashed px-4 py-6 text-center',
              fade(collapsed),
            )}
          >
            <p className="text-small font-medium">Couldn't load matches</p>
            <Button
              variant="ghost"
              size="xs"
              className="mt-2"
              onClick={() => void refetch()}
              loading={isFetching}
            >
              Try again
            </Button>
          </div>
        ) : (
          showSkeleton && (
            // Laid out like RecentRow: map icon, name and age, score on the right.
            <div className="grid" aria-hidden>
              {SKELETON_WIDTHS.map((width, i) => (
                <div
                  // oxlint-disable-next-line react/no-array-index-key -- fixed placeholder rows that never reorder
                  key={i}
                  className={cn(
                    'flex items-center',
                    handheld ? 'h-11.5 gap-2 px-2.5' : 'h-10 gap-2.5 px-2',
                  )}
                >
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <span className={cn('flex min-w-0 flex-1 items-center gap-2', fade(collapsed))}>
                    <span className="flex flex-1 items-center gap-1.5">
                      <Skeleton className={cn('h-3.5 rounded', width)} />
                      <Skeleton className="h-2.5 w-4 rounded" />
                    </span>
                    <Skeleton className="h-3 w-8 rounded" />
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </FadeSwap>
    </div>
  )
}
