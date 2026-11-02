import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { ShareActions } from '@/components/share-actions'
import { EditableImage } from '@/components/settings/editable-image'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FadeImage } from '@/components/ui/fade-image'
import { GeneratedBanner } from '@/components/profile/generated-banner'
import type { Player } from '@/lib/queries'

export const ProfileBanner = ({ player }: { player: Player }) => (
  // Edge to edge and flush with the top on phones.
  <EditableImage
    kind="banner"
    enabled={player.isMe}
    className="-mx-4 -mt-6 aspect-[3/1] max-h-64 overflow-hidden bg-linear-to-br from-surface-2 to-surface-3 md:mx-0 md:mt-0 md:rounded-2xl"
  >
    {player.bannerUrl ? (
      <FadeImage src={player.bannerUrl} alt="" className="size-full object-cover" />
    ) : (
      <GeneratedBanner seed={player.steamId} className="size-full" />
    )}
  </EditableImage>
)

export const ProfileIdentity = ({ player }: { player: Player }) => {
  const steamName =
    player.personaName && player.personaName !== player.name ? player.personaName : null

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <EditableImage
        kind="avatar"
        enabled={player.isMe}
        className="-mt-12 flex rounded-full ring-4 ring-surface md:-mt-14"
      >
        <Avatar
          src={player.avatarUrl}
          name={player.name}
          className="size-24 text-display md:size-28"
        />
      </EditableImage>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-section font-semibold tracking-tight">{player.name}</h1>
        {steamName && (
          <p className="truncate text-body text-muted">
            <span className="sr-only">Steam name: </span>
            {steamName} on Steam
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5">
          <ShareActions
            quiet
            url={`${window.location.origin}/players/${player.steamId}`}
            title={`${player.name} on subtick`}
          />
          {player.isMe && (
            <Button size="sm" variant="ghost" render={<Link to="/settings" hash="profile" />}>
              <Pencil /> Edit profile
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
