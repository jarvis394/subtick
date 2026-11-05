import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { HighlightCard } from '@/components/highlight-card'
import { playerSlug } from '@/components/player-link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { type Player, clipsQuery } from '@/lib/queries'
import { PlayerStats } from './player-stats'

/** Enough to fill two rows of three, or three of two. */
const PREVIEW_CLIPS = 6

export const OverviewTab = ({ player }: { player: Player }) => {
  const clips = useInfiniteQuery(clipsQuery({ kinds: [], steamId: player.steamId }))

  return (
    <div className="grid grid-cols-1 gap-12">
      <PlayerStats player={player} />

      <section>
        <div className="mb-4 flex h-8 items-center justify-between gap-4">
          <h2 className="text-title font-medium">Recent highlights</h2>
          {player.clipCount > PREVIEW_CLIPS && (
            <Button
              size="sm"
              variant="ghost"
              render={
                <Link to="/players/$player/highlights" params={{ player: playerSlug(player) }} />
              }
            >
              All {player.clipCount} clips <ChevronRight />
            </Button>
          )}
        </div>
        {clips.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: PREVIEW_CLIPS }, (_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : player.clipCount === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-body text-muted">
            No recorded clips yet. Aces, clutches and multi-kills show up here once recorded.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {(clips.data?.pages[0]?.items ?? [])
              .slice(0, PREVIEW_CLIPS)
              .map((clip) =>
                clip.clip ? (
                  <HighlightCard
                    key={clip.id}
                    highlight={{ ...clip, clip: clip.clip }}
                    player={clip.player}
                  />
                ) : null,
              )}
          </div>
        )}
      </section>
    </div>
  )
}
