import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { AUTH_COPY, type AuthMode, AuthForm, part } from '@/components/auth-form'
import { Button, IconButton } from '@/components/ui/button'

const COPY = {
  'sign-in': { title: 'Add an account', subtitle: 'Sign in to switch between your accounts' },
  'sign-up': { title: 'Add an account', subtitle: 'Ask to join this instance' },
} as const

/**
 * Switching modes morphs the form like the /login and /signup pages do, but the page behind the
 * dialog stays put: styles.css holds the root snapshot still while `data-auth-dialog` is set.
 */
const morph = (update: () => void) => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce) return update()
  const root = document.documentElement
  root.dataset.authDialog = ''
  const transition = document.startViewTransition(() => flushSync(update))
  void transition.finished.finally(() => delete root.dataset.authDialog)
}

/**
 * Signs another account in to this browser, beside the current one, as a dialog over the page.
 * The new account becomes the active one; email sign-up sends its confirmation link first.
 */
export const AuthDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>('sign-in')

  const signedIn = async () => {
    await queryClient.invalidateQueries()
    onOpenChange(false)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      // A fresh form each time, starting from sign-in.
      onOpenChangeComplete={(next) => !next && setMode('sign-in')}
    >
      {/* Opened from the account menu, which on phones sits in the nav drawer: a nested portal
          would land in that drawer's layer, under the page, so this one goes to the body. */}
      <Dialog.Portal container={document.body}>
        {/* Base UI drops the backdrop of a dialog nested in another (the phone nav drawer). */}
        <Dialog.Backdrop
          forceRender
          className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <Dialog.Popup
          className={
            // Its own view-transition name: on a mode switch only its outline is captured and
            // stretched, like the page's card, while the parts inside slide.
            'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[25rem] -translate-x-1/2 -translate-y-1/2 justify-items-center gap-6 overflow-y-auto rounded-[28px] border bg-surface p-6 pt-8 shadow-2xl outline-none select-none [view-transition-name:auth-dialog] [view-transition-class:auth] transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100'
          }
        >
          <Dialog.Close
            render={
              <IconButton
                label="Close"
                size="sm"
                tooltip={false}
                className="absolute top-3 right-3"
              />
            }
          >
            <X />
          </Dialog.Close>
          <div className="grid justify-items-center gap-1.5 text-center">
            <Dialog.Title className="font-display text-display tracking-tight [view-transition-name:auth-logo] [view-transition-class:auth]">
              {COPY[mode].title}
            </Dialog.Title>
            <Dialog.Description className="text-body text-muted [view-transition-name:auth-subtitle] [view-transition-class:auth]">
              {COPY[mode].subtitle}
            </Dialog.Description>
          </div>
          <AuthForm
            key={open ? 'open' : 'closed'}
            mode={mode}
            adding
            framed={false}
            // Steam leaves the page; it comes back here, signed in to the new account.
            steamCallbackURL={location.href}
            onSignedIn={signedIn}
          />
          <Button
            variant="ghost"
            className="-mt-2"
            style={part('switch')}
            onClick={() => morph(() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'))}
          >
            {AUTH_COPY[mode].switch}
          </Button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
