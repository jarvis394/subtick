import { multiSessionClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/** Accounts one browser can be signed in to at once; the api's multi-session limit. */
export const MAX_ACCOUNTS = 5

export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [multiSessionClient()],
})

/**
 * Gives the current session its multi-session cookie, so signing in to another account keeps it.
 * Sessions made before multi-session have none.
 */
export const adoptSession = () => authClient.$fetch('/multi-session/adopt', { method: 'POST' })

/**
 * Resolves when the page is shown again without having left: back from Steam into a restored
 * page (bfcache), or an installed app's in-app browser closed over it.
 */
const comeBack = () =>
  new Promise<void>((resolve) => {
    const done = (event: Event) => {
      if (event.type === 'pageshow' && !(event as PageTransitionEvent).persisted) return
      if (event.type === 'visibilitychange' && document.visibilityState !== 'visible') return
      window.removeEventListener('pageshow', done)
      window.removeEventListener('focus', done)
      document.removeEventListener('visibilitychange', done)
      resolve()
    }

    window.addEventListener('pageshow', done)
    window.addEventListener('focus', done)
    document.addEventListener('visibilitychange', done)
  })

/**
 * Steam is OpenID 2.0: the api returns Steam's login URL and the browser goes there. Resolves
 * only if the user comes back without finishing, so callers can stop showing it as pending.
 */
export const startSteamFlow = async (mode: 'sign-in' | 'link', callbackURL: string) => {
  const path = mode === 'sign-in' ? '/sign-in/steam' : '/link-social/steam'
  const { data, error } = await authClient.$fetch<{ url: string }>(path, {
    method: 'POST',
    body: { callbackURL },
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not start Steam sign-in')
  const back = comeBack()
  window.location.href = data.url
  await back
}

const AUTH_ERRORS: Record<string, string> = {
  steam_state_invalid: 'The Steam sign-in expired. Please try again',
  steam_assertion_invalid: 'Steam could not confirm the sign-in. Please try again',
  steam_session_mismatch: 'You were signed out while linking Steam. Sign in and try again',
  steam_account_in_use: 'That Steam account is already linked to another subtick account',
  steam_account_orphaned: 'That Steam account is in a broken state. Contact the admin',
  email_link_invalid: 'That email link has expired or was already used. Send a new one',
  email_in_use: 'Another subtick account took that email first. Try a different one',
  // better-auth's own codes when an email-confirmation link fails.
  INVALID_TOKEN: 'That confirmation link is invalid. Sign in to get a new one',
  TOKEN_EXPIRED: 'That confirmation link has expired. Sign in to get a new one',
}

export const describeAuthError = (code: string | undefined) =>
  code ? (AUTH_ERRORS[code] ?? 'Something went wrong. Please try again') : null
