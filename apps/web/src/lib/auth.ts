import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` })

/** Steam is OpenID 2.0: the api returns Steam's login URL and the browser goes there. */
export const startSteamFlow = async (mode: 'sign-in' | 'link', callbackURL: string) => {
  const path = mode === 'sign-in' ? '/sign-in/steam' : '/link-social/steam'
  const { data, error } = await authClient.$fetch<{ url: string }>(path, {
    method: 'POST',
    body: { callbackURL },
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not start Steam sign-in')
  window.location.href = data.url
}

const AUTH_ERRORS: Record<string, string> = {
  steam_state_invalid: 'The Steam sign-in expired. Please try again',
  steam_assertion_invalid: 'Steam could not confirm the sign-in. Please try again',
  steam_session_mismatch: 'You were signed out while linking Steam. Sign in and try again',
  steam_account_in_use: 'That Steam account is already linked to another subtick account',
  steam_account_orphaned: 'That Steam account is in a broken state. Contact the admin',
  email_link_invalid: 'That email link has expired or was already used. Send a new one',
  email_in_use: 'Another subtick account took that email first. Try a different one',
}

export const describeAuthError = (code: string | undefined) =>
  code ? (AUTH_ERRORS[code] ?? 'Something went wrong. Please try again') : null
