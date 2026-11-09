import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, LogOut, Monitor, Moon, Server, Settings, Sun, UserRound } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { playerSlug } from '@/components/player-link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Menu, MenuItem, MenuLabel, MenuRow, MenuSeparator } from '@/components/ui/menu'
import { Segmented } from '@/components/ui/segmented'
import { authClient } from '@/lib/auth'
import { meQuery } from '@/lib/queries'
import { clearStoredMe } from '@/lib/stored-me'
import { type Theme, applyTheme, storedTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { fade } from './rows'

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: <Monitor /> },
  { id: 'light', label: 'Light', icon: <Sun /> },
  { id: 'dark', label: 'Dark', icon: <Moon /> },
] as const satisfies { id: Theme; label: string; icon: ReactNode }[]

/** The same segmented switch as the highlight filters, as icons; picking one keeps the menu open. */
const ThemePicker = () => {
  const [theme, setTheme] = useState(storedTheme)

  const pick = (next: Theme) => {
    applyTheme(next)
    setTheme(next)
  }

  return (
    <MenuRow>
      Theme
      <Segmented label="Theme" value={theme} options={THEME_OPTIONS} onChange={pick} />
    </MenuRow>
  )
}

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
    <Menu
      title="Account"
      side="top"
      align="start"
      sideOffset={6}
      className="w-56"
      trigger={
        <Button
          variant="plain"
          className={cn(
            // A compact pill sized to the name; the email lives in the menu.
            'h-10 max-w-full justify-start gap-2 overflow-hidden rounded-lg px-1.5 text-left font-normal',
            // Narrows with the rail rather than at once, so the name fades instead of being cut.
            'transition-[max-width] duration-200 ease-out-quart motion-reduce:transition-none',
            collapsed && 'max-w-10',
          )}
        >
          <Avatar src={avatar} name={me.user.name} className="size-7" />
          <span className={cn('flex min-w-0 items-center gap-3 pr-1.5', fade(collapsed))}>
            <span className="truncate text-body font-medium">{me.user.name}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </span>
        </Button>
      }
    >
      <MenuLabel>{subtitle}</MenuLabel>
      {me.user.isAdmin && (
        <MenuItem
          onClick={() => {
            onNavigate?.()
            void navigate({ to: '/admin', viewTransition })
          }}
        >
          <Server /> Manage instance
        </MenuItem>
      )}
      {ownSteamLink && (
        <MenuItem
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
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          onNavigate?.()
          void navigate({ to: '/settings', viewTransition })
        }}
      >
        <Settings /> Settings
      </MenuItem>
      <MenuSeparator />
      <ThemePicker />
      <MenuSeparator />
      <MenuItem onClick={signOut}>
        <LogOut /> Sign out
      </MenuItem>
    </Menu>
  )
}
