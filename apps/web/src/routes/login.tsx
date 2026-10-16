import { Tabs } from '@base-ui/react/tabs'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { SteamIcon } from '@/components/steam-icon'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Wordmark } from '@/components/wordmark'
import { authClient, describeAuthError, startSteamFlow } from '@/lib/auth'
import { meQuery } from '@/lib/queries'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional(), error: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery).catch(() => null)
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

const tabClass =
  'relative z-10 h-8 flex-1 cursor-pointer rounded-lg text-sm text-muted transition-colors outline-none select-none hover:text-foreground data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(describeAuthError(search.error))
  const [pending, setPending] = useState<'email' | 'steam' | null>(null)

  // Only same-origin paths; anything else falls back to the feed.
  const next =
    search.redirect?.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setPending('email')
    setError(null)
    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get('name')) })
    setPending(null)
    if (result.error) return setError(result.error.message ?? 'Could not sign in')
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey })
    await navigate({ to: next })
  }

  const steam = async () => {
    setPending('steam')
    setError(null)
    // Steam returns here on failure (with ?error=) and to `next` on success.
    await startSteamFlow('sign-in', next).catch((e: Error) => {
      setError(e.message)
      setPending(null)
    })
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="text-3xl" />
          <p className="mt-2 text-sm text-muted">
            Your best Counter-Strike moments, clipped automatically.
          </p>
        </div>

        <div className="rounded-2xl border bg-surface p-5 shadow-sm shadow-black/[0.03]">
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={steam}
            disabled={pending !== null}
          >
            <SteamIcon />
            {pending === 'steam' ? 'Opening Steam…' : 'Continue with Steam'}
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs.Root value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
            <Tabs.List className="relative mb-4 flex rounded-[10px] bg-surface-2 p-0.5">
              <Tabs.Tab value="sign-in" className={tabClass}>
                Sign in
              </Tabs.Tab>
              <Tabs.Tab value="sign-up" className={tabClass}>
                Create account
              </Tabs.Tab>
              <Tabs.Indicator className="absolute top-0.5 left-0 z-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-lg bg-surface shadow-sm shadow-black/5 transition-[translate,width] duration-200 ease-out-quart" />
            </Tabs.List>
          </Tabs.Root>

          <form onSubmit={submit} className="grid gap-3.5">
            {mode === 'sign-up' && (
              <Field label="Name">
                <Input name="name" required autoComplete="nickname" />
              </Field>
            )}
            <Field label="Email">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field
              label="Password"
              description={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
            >
              <Input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending !== null}>
              {pending === 'email'
                ? 'One moment…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
