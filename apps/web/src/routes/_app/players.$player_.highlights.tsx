import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { HighlightsFeed } from '@/components/highlights-feed'
import { playerSlug } from '@/components/player-link'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/surface'
import { clipListSearch } from '@/lib/highlights'
import { playerQuery } from '@/lib/queries'

/** The highlights page, for one player. */
export const Route = createFileRoute('/_app/players/$player_/highlights')({
  head: () => ({ meta: [{ title: 'Player highlights · subtick' }] }),
  validateSearch: clipListSearch,
  component: PlayerHighlightsPage,
})

function PlayerHighlightsPage() {
  const params = Route.useParams()
  const player = useQuery(playerQuery(params.player))

  return (
    <div>
      <Link
        to="/players/$player"
        params={{ player: player.data ? playerSlug(player.data) : params.player }}
        className="mb-4 inline-flex items-center gap-1 text-body text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <div className="mb-6 flex items-center gap-3">
        {player.data ? (
          <Avatar src={player.data.avatarUrl} name={player.data.name} className="size-9" />
        ) : (
          <Skeleton className="size-9 rounded-full" />
        )}
        <h1 className="min-w-0 truncate font-serif text-display tracking-tight">
          {player.data ? `${player.data.name}’s highlights` : 'Highlights'}
        </h1>
      </div>
      {player.data && <HighlightsFeed steamId={player.data.steamId} />}
    </div>
  )
}
