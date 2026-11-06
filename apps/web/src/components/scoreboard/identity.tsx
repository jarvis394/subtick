import { Users } from 'lucide-react'
import { PartyMarker } from '@/components/party-marker'
import { PlayerAvatarLink, PlayerLink } from '@/components/player-link'
import { RankBadge } from '@/components/rank-badge'
import { Badge } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import type { PartyMarker as Marker } from '@/lib/party'
import { cn } from '@/lib/utils'
import { IDENTITY, NAME, RANK, block, shell } from './cells'
import type { Player } from './columns'

/**
 * The table lays out automatically and squeezes columns that don't fit, but the pinned name sits
 * exactly 4.25rem from the avatar's left edge. Fixed block widths keep both columns from shrinking.
 */
const PINNED_AVATAR = 'w-[4.25rem]'
const PINNED_NAME = 'w-[12rem]'

/** Party, player and rank headers, the pinned start of every scoreboard view. */
export const IdentityHeads = () => (
  <>
    <th className={shell(IDENTITY)} aria-label="Party and avatar">
      <div className={block(IDENTITY, true, cn(PINNED_AVATAR, 'pl-2.5'))}>
        <Tooltip
          content="Party"
          trigger={
            <span className="grid w-3 place-items-center">
              <Users className="size-3" aria-hidden />
            </span>
          }
        />
      </div>
    </th>
    <th className={shell(NAME)}>
      <div className={block(NAME, true, cn(PINNED_NAME, 'pl-3 font-medium md:pl-0'))}>Player</div>
    </th>
    <th className={shell(RANK)}>
      <div className={block(RANK, true, 'px-2.5 font-medium')}>Rank</div>
    </th>
  </>
)

export const IdentityCells = ({
  player: p,
  marker,
  isViewer,
}: {
  player: Player
  marker: Marker | undefined
  isViewer: boolean
}) => (
  <>
    <td className={shell(IDENTITY)}>
      <div className={block(IDENTITY, false, cn(PINNED_AVATAR, 'gap-2 pl-2.5'))}>
        <PartyMarker marker={marker} />
        <PlayerAvatarLink
          steamId={p.steamId}
          vanity={p.vanity}
          src={p.avatarUrl}
          name={p.name}
          className="size-7"
        />
      </div>
    </td>
    <td className={shell(NAME)}>
      <div className={block(NAME, false, cn(PINNED_NAME, 'gap-2 pr-2.5 pl-3 md:pl-0'))}>
        <PlayerLink
          steamId={p.steamId}
          vanity={p.vanity}
          className="truncate font-medium hover:text-foreground/80"
        >
          {p.name}
        </PlayerLink>
        {isViewer && (
          <Badge tone="accent" className="shrink-0">
            Me
          </Badge>
        )}
      </div>
    </td>
    <td className={shell(RANK)}>
      <div className={block(RANK, false, 'px-2.5 whitespace-nowrap')}>
        <RankBadge rank={p.rank} />
      </div>
    </td>
  </>
)
