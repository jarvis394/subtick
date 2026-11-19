import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Server,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { AuthDialog, type AuthDialogView } from '@/components/auth-dialog'
import { FadeSwap } from '@/components/fade-swap'
import { playerSlug } from '@/components/player-link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Menu,
  MenuItem,
  MenuLabel,
  MenuRow,
  MenuSeparator,
  MenuTile,
  MenuTiles,
} from '@/components/ui/menu'
import { Segmented } from '@/components/ui/segmented'
import { useSignOut, useSwitchAccount } from '@/hooks/use-accounts'
import { MAX_ACCOUNTS } from '@/lib/auth'
import { accountsQuery, meQuery } from '@/lib/queries'
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
  const { data: accounts = [] } = useQuery(accountsQuery)
  const signOut = useSignOut()
  const { switchTo, target } = useSwitchAccount()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<{ open: boolean; view: AuthDialogView }>({
    open: false,
    view: { kind: 'add' },
  })

  const avatar = me.user.avatarUrl
  const ownSteamLink = me.steamLinks[0]
  // The account being switched to lights up at once; the rest of the app follows when it loads.
  const shownId = target ?? me.user.id
  const shown = accounts.find((a) => a.id === shownId)
  const label = shown?.name || shown?.email || me.user.name

  return (
    <>
      <Menu
        title="Account"
        side="top"
        align="start"
        sideOffset={6}
        className="w-60"
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
        <MenuTiles>
          {accounts.length === 0 && (
            // Until the list loads, the one account this browser certainly has.
            <MenuTile label={me.user.name} selected closeOnClick={false}>
              <Avatar
                src={avatar}
                name={me.user.name}
                className="size-full rounded-[inherit] text-body"
              />
            </MenuTile>
          )}
          {accounts.map((account) => (
            <MenuTile
              key={account.id}
              label={account.name || account.email || 'Account'}
              selected={account.id === shownId}
              // Stays open, so the switch is seen landing; one awaiting approval shows its wait.
              closeOnClick={account.pending}
              onClick={() =>
                account.pending
                  ? setDialog({ open: true, view: { kind: 'pending', accountId: account.id } })
                  : void switchTo(account)
              }
            >
              <Avatar
                src={account.avatarUrl}
                name={account.name}
                className="size-full rounded-[inherit] text-body"
              />
            </MenuTile>
          ))}
          {accounts.length < MAX_ACCOUNTS && (
            <MenuTile
              label="Add an account"
              onClick={() => setDialog({ open: true, view: { kind: 'add' } })}
            >
              <Plus />
            </MenuTile>
          )}
        </MenuTiles>
        <FadeSwap swapKey={shownId} appear={false}>
          <MenuLabel>{label}</MenuLabel>
        </FadeSwap>
        <MenuSeparator />
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
        <MenuItem onClick={() => void signOut()}>
          <LogOut /> Sign out
        </MenuItem>
      </Menu>
      <AuthDialog
        {...dialog}
        onOpenChange={(open) => setDialog({ ...dialog, open })}
        onPending={(accountId) => setDialog({ open: true, view: { kind: 'pending', accountId } })}
      />
    </>
  )
}
