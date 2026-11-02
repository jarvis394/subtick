import { Menu } from '@base-ui/react/menu'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, LogOut, Server, Settings, UserRound } from 'lucide-react'
import { playerSlug } from '@/components/player-link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'
import { meQuery } from '@/lib/queries'
import { clearStoredMe } from '@/lib/stored-me'
import { cn } from '@/lib/utils'
import { fade } from './rows'

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body outline-none select-none data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted'

export const AccountMenu = ({
  collapsed,
  onNavigate,
  viewTransition,
}: {
  collapsed: boolean
  onNavigate?: () => void
  viewTransition?: boolean
}) => {
  const { data: me } = useSuspenseQuery(meQuery)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const avatar = me.user.avatarUrl
  const ownSteamLink = me.steamLinks[0]
  const subtitle = me.user.email.endsWith('@steam.invalid') ? 'Steam account' : me.user.email

  const signOut = async () => {
    await authClient.signOut()
    clearStoredMe()
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            variant="plain"
            className={cn(
              // A compact pill sized to the name; the email lives in the menu.
              'h-10 max-w-full justify-start gap-2 overflow-hidden rounded-lg px-1.5 text-left font-normal',
              // Narrows with the rail rather than at once, so the name fades instead of being cut.
              'transition-[max-width] duration-200 ease-out-quart motion-reduce:transition-none',
              collapsed && 'max-w-10',
            )}
          />
        }
      >
        <Avatar src={avatar} name={me.user.name} className="size-7" />
        <span className={cn('flex min-w-0 items-center gap-3 pr-1.5', fade(collapsed))}>
          <span className="truncate text-body font-medium">{me.user.name}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={6} className="z-50">
          <Menu.Popup className="w-56 origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
            <p className="truncate px-2 pt-1 pb-1.5 text-small text-muted">{subtitle}</p>
            {me.user.isAdmin && (
              <Menu.Item
                className={menuItemClass}
                onClick={() => {
                  onNavigate?.()
                  void navigate({ to: '/admin', viewTransition })
                }}
              >
                <Server /> Manage instance
              </Menu.Item>
            )}
            {ownSteamLink && (
              <Menu.Item
                className={menuItemClass}
                onClick={() => {
                  onNavigate?.()
                  void navigate({
                    to: '/players/$player',
                    params: { player: playerSlug(ownSteamLink) },
                    viewTransition,
                  })
                }}
              >
                <UserRound /> Your profile
              </Menu.Item>
            )}
            <Menu.Item
              className={menuItemClass}
              onClick={() => {
                onNavigate?.()
                void navigate({ to: '/settings', viewTransition })
              }}
            >
              <Settings /> Settings
            </Menu.Item>
            <Menu.Separator className="mx-1 my-1 h-px bg-border" />
            <Menu.Item className={menuItemClass} onClick={signOut}>
              <LogOut /> Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
