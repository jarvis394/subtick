/**
 * better-auth plugin: sign in with Steam, or link Steam to the signed-in account.
 *
 *   POST /api/auth/sign-in/steam    { callbackURL }  → { url }  (open it in the browser)
 *   POST /api/auth/link-social/steam { callbackURL } → { url }  (requires a session)
 *   GET  /api/auth/steam/callback                    ← Steam redirects here
 *
 * On failure the browser lands on `callbackURL?error=<code>`.
 *
 * Paths match the proposed upstream plugin (better-auth/better-auth#4877) to ease a later switch.
 * Unlike that proposal, flow state (mode, user, callback) is stored server-side and single-use,
 * and linking re-checks that the finishing browser is signed in as the user who started it.
 */
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { steamLoginUrl, verifySteamAssertion } from './steam-openid'

export const STEAM_PROVIDER_ID = 'steam'
const STATE_PREFIX = 'steam-openid:'
const STATE_TTL_MS = 10 * 60 * 1000

export interface SteamPluginOptions {
  getProfile(steamId: string): Promise<{ name: string; image: string | null } | null>
  /** Called whenever a Steam account is signed in with or linked to `userId`. */
  onAccount(userId: string, steamId: string): Promise<void>
}

const State = z.object({
  mode: z.enum(['sign-in', 'link']),
  userId: z.string().optional(),
  callbackURL: z.string(),
})
type State = z.infer<typeof State>

/** Only same-origin paths, so the callback can't be used as an open redirect. */
const CallbackURL = z
  .string()
  .regex(/^\/(?!\/)/, 'callbackURL must be a path')
  .default('/')

const withError = (path: string, error: string) => {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set('error', error)
  return `${pathname}?${params}`
}

export const steam = (options: SteamPluginOptions) =>
  ({
    id: 'steam',
    endpoints: {
      steamSignIn: createAuthEndpoint(
        '/sign-in/steam',
        { method: 'POST', body: z.object({ callbackURL: CallbackURL }) },
        async (ctx) =>
          ctx.json({
            url: await startFlow(ctx, { mode: 'sign-in', callbackURL: ctx.body.callbackURL }),
          }),
      ),

      steamLink: createAuthEndpoint(
        '/link-social/steam',
        { method: 'POST', body: z.object({ callbackURL: CallbackURL }), use: [sessionMiddleware] },
        async (ctx) =>
          ctx.json({
            url: await startFlow(ctx, {
              mode: 'link',
              userId: ctx.context.session.user.id,
              callbackURL: ctx.body.callbackURL,
            }),
          }),
      ),

      steamCallback: createAuthEndpoint(
        '/steam/callback',
        { method: 'GET', query: z.record(z.string(), z.string()) },
        async (ctx) => {
          const stateId = ctx.query.state ?? ''
          const record = await ctx.context.internalAdapter.consumeVerificationValue(
            `${STATE_PREFIX}${stateId}`,
          )
          const parsed =
            record && record.expiresAt > new Date()
              ? State.safeParse(JSON.parse(record.value))
              : null
          if (!parsed?.success) throw ctx.redirect(withError('/', 'steam_state_invalid'))
          const state = parsed.data
          const fail = (code: string): never => {
            throw ctx.redirect(withError(state.callbackURL, code))
          }

          const steamId = await verifySteamAssertion(
            ctx.query,
            callbackUrl(ctx.context.baseURL, stateId),
          )
          if (!steamId) return fail('steam_assertion_invalid')

          const key = { providerId: STEAM_PROVIDER_ID, accountId: steamId }
          const owner = await ctx.context.internalAdapter.findAccountOwnerByKey(key)

          if (state.mode === 'link') {
            // The browser that finishes the flow must still be signed in as the user who started it.
            const session = await getSessionFromCtx(ctx)
            if (!session || session.user.id !== state.userId) return fail('steam_session_mismatch')
            if (owner && (owner.kind !== 'owned' || owner.user.id !== state.userId)) {
              return fail('steam_account_in_use')
            }
            if (!owner)
              await ctx.context.internalAdapter.linkAccount({ ...key, userId: state.userId })
            await options.onAccount(state.userId, steamId)
            throw ctx.redirect(state.callbackURL)
          }

          if (owner?.kind === 'orphaned') return fail('steam_account_orphaned')
          let user = owner?.user
          if (!user) {
            const profile = await options.getProfile(steamId)
            const created = await ctx.context.internalAdapter.createOAuthUser(
              {
                name: profile?.name ?? steamId,
                // better-auth requires an email; Steam has none. Users can change it later.
                email: `${steamId}@steam.invalid`,
                emailVerified: false,
                image: profile?.image ?? null,
              },
              key,
            )
            user = created.user
          }
          await options.onAccount(user.id, steamId)

          const session = await ctx.context.internalAdapter.createSession(user.id)
          if (!session) return fail('session_failed')
          await setSessionCookie(ctx, { session, user })
          throw ctx.redirect(state.callbackURL)
        },
      ),
    },
  }) satisfies BetterAuthPlugin

const callbackUrl = (authBaseURL: string, state: string) =>
  `${authBaseURL}/steam/callback?${new URLSearchParams({ state })}`

type AuthContext = {
  context: {
    baseURL: string
    internalAdapter: {
      createVerificationValue: (v: {
        identifier: string
        value: string
        expiresAt: Date
      }) => Promise<unknown>
    }
  }
}

const startFlow = async (ctx: AuthContext, state: State) => {
  const id = crypto.randomUUID()
  await ctx.context.internalAdapter.createVerificationValue({
    identifier: `${STATE_PREFIX}${id}`,
    value: JSON.stringify(state),
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  })
  return steamLoginUrl(callbackUrl(ctx.context.baseURL, id))
}
