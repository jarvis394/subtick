import { type ComponentType, type SVGProps, useState } from 'react'
import { SteamIcon } from '@/components/steam-icon'
import { Button, type ButtonProps } from '@/components/ui/button'
import { startSteamFlow } from '@/lib/auth'

type Flow = (mode: 'sign-in' | 'link', callbackURL: string) => Promise<void>

const PROVIDERS: Record<'steam', { icon: ComponentType<SVGProps<SVGSVGElement>>; start: Flow }> = {
  steam: { icon: SteamIcon, start: startSteamFlow },
}

export type Provider = keyof typeof PROVIDERS

/**
 * Signs in with, or links, a third-party account. It spins until the browser leaves for the
 * provider, and stops again if the user comes back without finishing (closed the popup, pressed
 * back), so it never stays stuck.
 */
export const ProviderButton = ({
  provider,
  mode,
  callbackURL,
  beforeStart,
  onError,
  onPendingChange,
  children,
  ...props
}: Omit<ButtonProps, 'onClick' | 'onError' | 'loading' | 'render'> & {
  provider: Provider
  mode: 'sign-in' | 'link'
  /** Where the provider sends the browser back to, finished or with `?error=`. */
  callbackURL: string
  /** Runs first, while the button already spins (e.g. keeping the current session). */
  beforeStart?: () => Promise<unknown>
  onError: (error: Error) => void
  onPendingChange?: (pending: boolean) => void
}) => {
  const [pending, setPending] = useState(false)
  const { icon: Icon, start } = PROVIDERS[provider]

  const set = (next: boolean) => {
    setPending(next)
    onPendingChange?.(next)
  }

  const run = () => {
    set(true)
    void Promise.resolve(beforeStart?.())
      .then(() => start(mode, callbackURL))
      .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))))
      .then(() => set(false))
  }

  return (
    <Button {...props} loading={pending} onClick={run}>
      <Icon />
      {children}
    </Button>
  )
}
