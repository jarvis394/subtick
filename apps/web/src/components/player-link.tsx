import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/** A profile URL's player segment: the Steam vanity name when the player has one, else the ID. */
export const playerSlug = ({ steamId, vanity }: { steamId: string; vanity?: string | null }) =>
  vanity ?? steamId

/** Wraps a player's name or avatar in a link to their profile. */
export const PlayerLink = ({
  steamId,
  vanity,
  className,
  children,
}: {
  steamId: string
  vanity?: string | null
  className?: string
  children: ReactNode
}) => (
  <Link
    to="/players/$player"
    params={{ player: playerSlug({ steamId, vanity }) }}
    className={cn(
      'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
  >
    {children}
  </Link>
)

/** A player's avatar that opens their profile; out of the tab order, since the name beside it links too. */
export const PlayerAvatarLink = ({
  steamId,
  vanity,
  src,
  name,
  className,
}: {
  steamId: string
  vanity?: string | null
  src?: string | null
  name: string
  className?: string
}) => (
  <Link
    to="/players/$player"
    params={{ player: playerSlug({ steamId, vanity }) }}
    tabIndex={-1}
    aria-hidden
    className="flex shrink-0 rounded-full transition-opacity hover:opacity-80"
  >
    <Avatar src={src} name={name} className={className} />
  </Link>
)
