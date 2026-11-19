import { MailCheck } from 'lucide-react'
import { type CSSProperties, type FormEvent, useState } from 'react'
import { FadeSwap } from '@/components/fade-swap'
import { ProviderButton } from '@/components/provider-button'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/field'
import { adoptSession, authClient } from '@/lib/auth'
import { cn } from '@/lib/utils'

export type AuthMode = 'sign-in' | 'sign-up'
type FieldName = 'name' | 'email' | 'password'
type Errors = Partial<Record<FieldName | 'form', string>>

/** better-auth error codes, in plain words and pinned to the field they're about. */
const AUTH_ERRORS: Record<string, [FieldName | 'form', string]> = {
  INVALID_EMAIL: ['email', "That doesn't look like an email address"],
  USER_ALREADY_EXISTS: ['email', 'An account with this email already exists. Sign in instead'],
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: [
    'email',
    'An account with this email already exists. Sign in instead',
  ],
  INVALID_EMAIL_OR_PASSWORD: ['form', 'Wrong email or password'],
  EMAIL_NOT_VERIFIED: ['form', 'Confirm your email first. We sent a new link to it'],
  PASSWORD_TOO_SHORT: ['password', 'Use at least 8 characters'],
  PASSWORD_TOO_LONG: ['password', 'That password is too long'],
}

/** What a rejected value means, in words, for validation errors on one field. */
const FIELD_PROBLEM: Record<FieldName, string> = {
  name: 'Enter a name, up to 64 characters',
  email: "That doesn't look like an email address",
  password: 'Use at least 8 characters',
}

/**
 * Turns an auth error into a message for one field or for the whole form. Validation errors that
 * have no code of their own arrive as "[body.email] Invalid email address": the bracket names the
 * field.
 */
const describeError = (error: { code?: string; message?: string }): Errors => {
  const known = error.code && AUTH_ERRORS[error.code]
  if (known) return { [known[0]]: known[1] }
  const match = error.message?.match(/^\[body\.(\w+)\]/)
  const field = match?.[1] as FieldName | undefined
  if (field && field in FIELD_PROBLEM) return { [field]: FIELD_PROBLEM[field] }

  return { form: error.message || 'Couldn’t reach subtick. Check your connection and try again' }
}

/** A piece that morphs between the two screens; styles.css times the `auth` class. */
export const part = (name: string) =>
  ({ viewTransitionName: `auth-${name}`, viewTransitionClass: 'auth' }) as CSSProperties

export const AUTH_COPY = {
  'sign-in': { subtitle: 'Your best Counter-Strike moments', switch: 'I do not have an account' },
  'sign-up': { subtitle: 'Ask to join this instance', switch: 'I already have an account' },
} as const

/**
 * The sign-in and sign-up form: Steam, then email. The /login page and the add-account dialog
 * both render it. `adding` keeps the browser's current account signed in beside the new one.
 * Every piece has a view-transition name, so a mode switch morphs it in place (styles.css).
 */
export const AuthForm = ({
  mode,
  adding = false,
  framed = true,
  steamCallbackURL,
  initialError,
  onSignedIn,
}: {
  mode: AuthMode
  adding?: boolean
  /** The bordered card of the full page; a dialog is a card already. */
  framed?: boolean
  /** Where Steam returns to, signed in or with `?error=`. */
  steamCallbackURL: string
  initialError?: string | null
  onSignedIn: () => Promise<unknown>
}) => {
  const [errors, setErrors] = useState<Errors>(() => (initialError ? { form: initialError } : {}))
  const [pending, setPending] = useState<'email' | 'steam' | null>(null)
  // Sign-up doesn't sign in: the address is confirmed first, by a link sent to it.
  const [sentTo, setSentTo] = useState<string | null>(null)

  // Editing a field clears what was wrong with it.
  const clearError = (field: FieldName) =>
    errors[field] && setErrors((all) => ({ ...all, [field]: undefined }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setPending('email')
    setErrors({})
    if (adding) await adoptSession()
    // The confirmation link lands on /login, which sends a now signed-in browser on into the app.
    const callbackURL = '/login'
    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password, callbackURL })
        : await authClient.signUp.email({
            email,
            password,
            name: String(form.get('name')),
            callbackURL,
          })
    if (result.error) {
      setPending(null)

      return setErrors(describeError(result.error))
    }
    if (mode === 'sign-up') {
      setPending(null)

      return setSentTo(email)
    }
    await onSignedIn()
    setPending(null)
  }

  // Each part has its own name, so it slides to its new place instead of the card's contents
  // crossfading as one picture; the card's own snapshot is just its outline.
  return (
    <div
      className={cn(
        'w-full [view-transition-name:auth-card] [view-transition-class:auth]',
        framed && 'rounded-[28px] border p-6',
      )}
    >
      {/* Once sent, the form gives way to what happens next; reduced motion keeps the fade only. */}
      <FadeSwap swapKey={sentTo ? 'sent' : 'form'} appear={false} mode="wait">
        {sentTo ? (
          <div role="status" className="grid gap-2 select-text">
            <p className="flex items-center gap-2 font-medium">
              <MailCheck className="size-4 text-muted" />
              Check your inbox
            </p>
            <p className="text-body text-muted">
              We sent a link to <span className="text-foreground">{sentTo}</span>. Open it to
              confirm your email. An admin then approves your account before you can use subtick.
            </p>
            <p className="text-small text-muted">
              Didn’t get it? Sign in with the same email and password to get a new link.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <ProviderButton
              provider="steam"
              mode="sign-in"
              callbackURL={steamCallbackURL}
              variant="secondary"
              size="lg"
              className="w-full [view-transition-name:auth-steam] [view-transition-class:auth]"
              disabled={pending === 'email'}
              beforeStart={adding ? adoptSession : undefined}
              onPendingChange={(on) => {
                setPending(on ? 'steam' : null)
                if (on) setErrors({})
              }}
              onError={(e) => setErrors({ form: e.message })}
            >
              Continue with Steam
            </ProviderButton>

            <p className="text-center text-label text-muted [view-transition-name:auth-or] [view-transition-class:auth]">
              OR
            </p>

            {/* Flex, not grid: a closed error's negative margin has to cancel the gap before it, and
            grid rows can't shrink below zero. */}
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === 'sign-up' && (
                <Field
                  label="Name"
                  className="flex flex-col"
                  style={part('name')}
                  invalid={Boolean(errors.name)}
                >
                  <Input
                    name="name"
                    placeholder="Alex"
                    required
                    autoComplete="nickname"
                    className="h-11"
                    onChange={() => clearError('name')}
                  />
                  <ErrorText message={errors.name} gap="0.375rem" />
                </Field>
              )}
              <Field
                label="Email"
                className="flex flex-col"
                style={part('email')}
                invalid={Boolean(errors.email)}
              >
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-11"
                  onChange={() => clearError('email')}
                />
                <ErrorText message={errors.email} gap="0.375rem" />
              </Field>
              <Field
                label="Password"
                className="flex flex-col"
                style={part('password')}
                invalid={Boolean(errors.password)}
              >
                <PasswordInput
                  className="h-11"
                  name="password"
                  placeholder={mode === 'sign-in' ? 'Enter your password' : 'At least 8 characters'}
                  required
                  minLength={8}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  onChange={() => {
                    clearError('password')
                    // A wrong password is the form's error; retyping it is the fix.
                    if (errors.form) setErrors((all) => ({ ...all, form: undefined }))
                  }}
                />
                <ErrorText message={errors.password} gap="0.375rem" />
              </Field>
              <ErrorText message={errors.form} gap="0.75rem" style={part('error')} />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-1 w-full"
                style={part('submit')}
                disabled={pending === 'steam'}
                loading={pending === 'email'}
              >
                {mode === 'sign-in' ? 'Continue with email' : 'Request access'}
              </Button>
            </form>
          </div>
        )}
      </FadeSwap>
    </div>
  )
}

/**
 * An error line that grows open and collapses shut (a 0fr <-> 1fr grid row) instead of popping in
 * and shoving the form. It keeps showing the last message while it closes; `gap` cancels the
 * parent's gap while closed.
 */
const ErrorText = ({
  message,
  gap,
  style,
}: {
  message?: string
  gap: string
  style?: CSSProperties
}) => {
  const [shown, setShown] = useState(message)
  if (message && message !== shown) setShown(message)
  const open = Boolean(message)

  return (
    <div
      aria-live="polite"
      style={{
        ...style,
        gridTemplateRows: open ? '1fr' : '0fr',
        marginTop: open ? 0 : `calc(-1 * ${gap})`,
      }}
      className={cn(
        'grid transition-[grid-template-rows,margin,opacity] duration-200 ease-out-quart motion-reduce:transition-none',
        open ? 'opacity-100' : 'opacity-0',
      )}
    >
      <p className="min-h-0 overflow-hidden text-small text-danger">{open ? message : shown}</p>
    </div>
  )
}
