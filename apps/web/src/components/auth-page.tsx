import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { type CSSProperties, type FormEvent, useState } from 'react'
import { SteamIcon } from '@/components/steam-icon'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/field'
import { Wordmark } from '@/components/wordmark'
import { authClient, describeAuthError, startSteamFlow } from '@/lib/auth'
import { meQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Mode = 'sign-in' | 'sign-up'
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

  return { form: error.message || 'Something went wrong. Please try again' }
}

/** A piece that morphs between the two screens; styles.css times the `auth` class. */
const part = (name: string) =>
  ({ viewTransitionName: `auth-${name}`, viewTransitionClass: 'auth' }) as CSSProperties

const COPY = {
  'sign-in': { subtitle: 'Your best Counter-Strike moments', switch: 'I do not have an account' },
  'sign-up': { subtitle: 'Create your account, for free', switch: 'I already have an account' },
} as const

/**
 * The sign-in and sign-up screens: one layout, two routes. Moving between them is a view
 * transition in which the subtitle, the card and the switch button morph into their new place
 * (names and timing in styles.css), so the card grows to make room for the name field.
 */
export const AuthPage = ({ mode }: { mode: Mode }) => {
  const search = useSearch({ strict: false }) as { redirect?: string; error?: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Errors>(() => {
    const steamError = describeAuthError(search.error)

    return steamError ? { form: steamError } : {}
  })

  const [pending, setPending] = useState<'email' | 'steam' | null>(null)
  // Only same-origin paths; anything else falls back to the feed.
  const next =
    search.redirect?.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/'

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
    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get('name')) })
    setPending(null)
    if (result.error) return setErrors(describeError(result.error))
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey })
    await navigate({ to: next })
  }

  const steam = async () => {
    setPending('steam')
    setErrors({})
    // Steam returns to the sign-in page on failure (with ?error=) and to `next` on success.
    await startSteamFlow('sign-in', next).catch((e: Error) => {
      setErrors({ form: e.message })
      setPending(null)
    })
  }

  // Only the heading is text worth copying; it and the inputs opt back in (select-text).
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-12 pb-8 select-none">
      <div className="grid w-full max-w-[25rem] flex-1 content-center justify-items-center gap-8">
        <div className="grid justify-items-center gap-2 text-center select-text">
          <h1 className="[view-transition-name:auth-logo] [view-transition-class:auth]">
            <Wordmark className="text-hero" />
          </h1>
          <p className="font-serif text-heading tracking-tight text-muted [view-transition-name:auth-subtitle] [view-transition-class:auth]">
            {COPY[mode].subtitle}
          </p>
        </div>

        {/* Each part has its own name, so it slides to its new place instead of the card's
          contents crossfading as one picture; the card's own snapshot is just its outline. */}
        <div className="w-full rounded-[28px] border p-6 [view-transition-name:auth-card] [view-transition-class:auth]">
          <div className="grid gap-4">
            <Button
              variant="secondary"
              size="lg"
              className="w-full [view-transition-name:auth-steam] [view-transition-class:auth]"
              onClick={steam}
              disabled={pending === 'email'}
              loading={pending === 'steam'}
            >
              <SteamIcon />
              Continue with Steam
            </Button>

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
                    placeholder="Enter your name"
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
                  placeholder="Enter your email"
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
                {mode === 'sign-in' ? 'Continue with email' : 'Create account'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Pinned to the bottom of the page, apart from the form. */}
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
        {COPY[mode].switch}
      </Button>
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
