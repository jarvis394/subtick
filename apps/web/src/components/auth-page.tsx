import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AuthFrame } from '@/components/auth-frame'
import { AUTH_COPY, type AuthMode, AuthForm, part } from '@/components/auth-form'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { describeAuthError } from '@/lib/auth'
import { meQuery } from '@/lib/queries'

/**
 * The sign-in and sign-up screens: one layout, two routes. Moving between them is a view
 * transition in which the subtitle, the card and the switch button morph into their new place
 * (names and timing in styles.css), so the card grows to make room for the name field.
 */
export const AuthPage = ({ mode }: { mode: AuthMode }) => {
  const search = useSearch({ strict: false }) as { redirect?: string; error?: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Only same-origin paths; anything else falls back to the feed.
  const next =
    search.redirect?.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/'

  const signedIn = async () => {
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey })
    await navigate({ to: next })
  }

  // Only the heading is text worth copying; it and the inputs opt back in (select-text).
  return (
    <AuthFrame
      className="select-none"
      // Pinned to the bottom of the page, apart from the form.
      footer={
        <Button
          variant="ghost"
          className="mt-8"
          style={part('switch')}
          render={
            <Link
              to={mode === 'sign-in' ? '/signup' : '/login'}
              search={{ redirect: search.redirect }}
            />
          }
        >
          {AUTH_COPY[mode].switch}
        </Button>
      }
    >
      <div className="grid justify-items-center gap-2 text-center select-text">
        <h1 className="[view-transition-name:auth-logo] [view-transition-class:auth]">
          <Wordmark className="text-hero" />
        </h1>
        <p className="font-display text-heading tracking-tight text-muted [view-transition-name:auth-subtitle] [view-transition-class:auth]">
          {AUTH_COPY[mode].subtitle}
        </p>
      </div>
      <AuthForm
        // Steam returns here on failure (with ?error=) and to `next` on success.
        steamCallbackURL={next}
        initialError={describeAuthError(search.error)}
        mode={mode}
        onSignedIn={signedIn}
      />
    </AuthFrame>
  )
}
