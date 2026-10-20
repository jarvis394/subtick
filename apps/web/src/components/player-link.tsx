import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/** Wraps a player's name or avatar in a link to their profile. */
export const PlayerLink = ({
  steamId,
  className,
  children,
}: {
  steamId: string
  className?: string
  children: ReactNode
}) => (
  <Link
    to="/players/$steamId"
    params={{ steamId }}
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
  src,
  name,
  className,
}: {
  steamId: string
  src?: string | null
  name: string
  className?: string
}) => (
  <Link
    to="/players/$steamId"
    params={{ steamId }}
    tabIndex={-1}
    aria-hidden
    className="shrink-0 rounded-full transition-opacity hover:opacity-80"
  >
    <Avatar src={src} name={name} className={className} />
  </Link>
)
