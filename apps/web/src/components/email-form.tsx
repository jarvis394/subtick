import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/field'
import { authClient } from '@/lib/auth'

const ERRORS: Record<string, string> = {
  email_unchanged: "That's already your email",
  email_in_use: 'Another subtick account already uses this email',
  password_required: 'Choose a password to sign in with',
  password_too_short: 'Use at least 8 characters',
  password_too_long: 'That password is too long',
  email_send_failed: "We couldn't send the email. Try again in a minute",
}

/**
 * Sends a magic link to the new address; opening it switches the account's email. Steam-only
 * accounts also pick a password here, so the email becomes a way to sign in.
 */
export const EmailForm = ({ adding }: { adding: boolean }) => {
  const send = useMutation({
    mutationFn: async (body: { email: string; password?: string }) => {
      const { data, error } = await authClient.$fetch<{ email: string }>('/email/change', {
        method: 'POST',
        body,
      })
      if (error) {
        throw new Error(
          ERRORS[error.message ?? ''] ??
            (error.status === 429 ? 'Too many tries. Wait a minute' : error.message) ??
            'Something went wrong. Please try again',
        )
      }
      return data
    },
  })

  if (send.data) {
    return (
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="grid gap-1 text-sm">
          <p>
            Check <span className="font-medium">{send.data.email}</span> for a link from us.
          </p>
          <p className="text-muted">
            Open it within an hour to {adding ? 'add' : 'switch to'} this email.{' '}
            <Button variant="link" onClick={() => send.reset()}>
              Use another address
            </Button>
          </p>
        </div>
      </div>
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    send.mutate({
      email: String(form.get('email')),
      password: adding ? String(form.get('password')) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label={adding ? 'Address' : 'New address'}>
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>
      {adding && (
        <Field
          label="Password"
          description="At least 8 characters. You'll sign in with it and your email."
        >
          <PasswordInput
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
      )}
      {send.error && <p className="text-sm text-danger">{send.error.message}</p>}
      <div>
        <Button type="submit" variant="secondary" loading={send.isPending}>
          Send confirmation link
        </Button>
      </div>
    </form>
  )
}
