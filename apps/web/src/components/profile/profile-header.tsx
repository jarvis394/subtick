import { standingRank } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { GeneratedBanner } from '@/components/profile/generated-banner'
import { playerSlug } from '@/components/player-link'
import { RankBadge } from '@/components/rank-badge'
import { EditableImage } from '@/components/settings/editable-image'
import { ShareActions } from '@/components/share-actions'
import { Avatar } from '@/components/ui/avatar'
import { IconButton } from '@/components/ui/button'
import { FadeImage } from '@/components/ui/fade-image'
import { Card } from '@/components/ui/surface'
import { timeAgo } from '@/lib/format'
import type { Player } from '@/lib/queries'

/** Premier when the player has it, otherwise the highest Competitive group. */
const headlineRank = ({ premier, competitive }: Player['ranks']) => {
  if (premier) return standingRank('premier', premier.current)

  return competitive && standingRank('competitive', competitive.best)
}

export const ProfileHeader = ({ player }: { player: Player }) => {
  const rank = headlineRank(player.ranks)

  return (
    // Flush with the top of the page on phones.
    <Card bleed className="-mt-6 overflow-hidden border-t-0 md:mt-0 md:border-t">
      <EditableImage
        kind="banner"
        enabled={player.isMe}
        className="aspect-[3/1] overflow-hidden bg-surface-2 @3xl:aspect-[4/1]"
      >
        {player.bannerUrl ? (
          <FadeImage src={player.bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <GeneratedBanner seed={player.steamId} className="size-full" />
        )}
      </EditableImage>

      <div className="flex flex-wrap items-start gap-x-5 px-4 pb-4 md:px-6 md:pb-5">
        <EditableImage
          kind="avatar"
          enabled={player.isMe}
          // Positioned, so it stays over the banner while the banner image (a layer of its own
          // until its fade-in finishes) loads, page transitions included.
          className="relative -mt-12 flex rounded-full ring-4 ring-surface @2xl:-mt-16"
        >
          <Avatar
            src={player.avatarUrl}
            name={player.name}
            className="size-24 text-display @2xl:size-32"
          />
        </EditableImage>

        <div className="order-last mt-3 min-w-0 basis-full @2xl:order-none @2xl:basis-0 @2xl:grow">
          <h1 className="truncate text-display font-semibold tracking-tight">{player.name}</h1>
          {(rank || player.lastMatchAt) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-muted">
              {rank && <RankBadge rank={rank} showChange={false} />}
              {player.lastMatchAt && <span>Last played {timeAgo(player.lastMatchAt)}</span>}
            </p>
          )}
        </div>

        <div className="mt-3 ml-auto flex items-center gap-1.5 @2xl:ml-0">
          {player.isMe && (
            <IconButton
              variant="quiet"
              label="Edit profile"
              render={<Link to="/settings" hash="profile" />}
            >
              <Pencil />
            </IconButton>
          )}
          <ShareActions
            quiet
            url={`${window.location.origin}/players/${playerSlug(player)}`}
            title={`${player.name} on subtick`}
          />
        </div>
      </div>
    </Card>
  )
}
