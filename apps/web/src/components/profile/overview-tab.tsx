import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BarChart3, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { HighlightCard } from '@/components/highlight-card'
import { playerSlug } from '@/components/player-link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { type Player, clipsQuery } from '@/lib/queries'
import { BestMapCard } from './best-map-card'
import { bestMatch } from './facts'
import { SplitSessions } from './session-overview'
import { SkillCards } from './skill-cards'

const CLIP_GRID = 'grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3'

/** Enough to fill two rows of three, or three of two. */
const PREVIEW_CLIPS = 6
const BEST_OF_MATCHES = 20

const Highlights = ({ player }: { player: Player }) => {
  const clips = useInfiniteQuery(clipsQuery({ kinds: [], steamId: player.steamId }))
  const items = (clips.data?.pages[0]?.items ?? []).slice(0, PREVIEW_CLIPS)

  return (
    <section>
      <div className="mb-4 flex h-8 items-center justify-between gap-4">
        <h2 className="text-title font-medium">Highlights</h2>
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
        <div className={CLIP_GRID}>
          {Array.from({ length: PREVIEW_CLIPS }, (_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : items.length ? (
        <div className={CLIP_GRID}>
          {items.map((clip) =>
            clip.clip ? (
              <HighlightCard
                key={clip.id}
                highlight={{ ...clip, clip: clip.clip }}
                player={clip.player}
              />
            ) : null,
          )}
        </div>
      ) : (
        <p className="-mx-4 border-y border-dashed px-4 py-8 text-center text-body text-muted md:mx-0 md:rounded-xl md:border-x">
          No recorded clips yet. Aces, clutches and multi-kills show up here once recorded.
        </p>
      )}
    </section>
  )
}

const Stats = ({ player: { history, matchCount } }: { player: Player }) => (
  <>
    <SplitSessions history={history} matchCount={matchCount} />
    <section>
      <h2 className="mb-4 flex flex-wrap items-baseline gap-x-3 text-title font-medium">
        Best map
        <span className="text-small font-normal text-muted">
          {`of the last ${Math.min(history.length, BEST_OF_MATCHES)} matches`}
        </span>
      </h2>
      <BestMapCard match={bestMatch(history.slice(0, BEST_OF_MATCHES))} />
    </section>
    <SkillCards history={history} />
  </>
)

export const OverviewTab = ({ player }: { player: Player }) => (
  <div className="grid grid-cols-1 gap-8">
    <Highlights player={player} />
    {player.history.length ? (
      <Stats player={player} />
    ) : (
      <EmptyState
        icon={<BarChart3 />}
        title="No stats yet"
        description="Stats appear here after the first analyzed match."
      />
    )}
  </div>
)
