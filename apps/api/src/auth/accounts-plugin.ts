/**
 * better-auth plugin beside `multiSession`: `POST /api/auth/multi-session/adopt` gives the browser's
 * current session the `_multi-` cookie that multi-session only sets when a session is created.
 * Sessions from before the plugin have none, and signing in to another account would drop them.
 */
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'

export const accounts = () =>
  ({
    id: 'accounts',
    endpoints: {
      adoptSession: createAuthEndpoint(
        '/multi-session/adopt',
        { method: 'POST', use: [sessionMiddleware] },
        async (ctx) => {
          const config = ctx.context.authCookies.sessionToken
          const { token } = ctx.context.session.session
          const name = `${config.name}_multi-${token.toLowerCase()}`
          const existing = await ctx.getSignedCookie(name, ctx.context.secret)
          if (!existing)
            await ctx.setSignedCookie(name, token, ctx.context.secret, config.attributes)

          return ctx.json({ ok: true })
        },
      ),
    },
  }) satisfies BetterAuthPlugin
