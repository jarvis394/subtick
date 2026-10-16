import { Elysia } from 'elysia'
import type { Context } from './context'
import { eventRoutes } from './routes/events'
import { highlightRoutes } from './routes/highlights'
import { matchRoutes } from './routes/matches'
import { meRoutes } from './routes/me'
import { steamLinkRoutes } from './routes/steam-links'

export const createApp = (ctx: Context) =>
  new Elysia()
    // better-auth owns /api/auth/* (email + password, Steam OpenID, sessions).
    .mount(ctx.auth.handler)
    .group('/api', (api) =>
      api
        .get('/health', () => ({ ok: true as const }))
        .use(meRoutes(ctx))
        .use(steamLinkRoutes(ctx))
        .use(matchRoutes(ctx))
        .use(highlightRoutes(ctx))
        .use(eventRoutes(ctx)),
    )
    .onError(({ code, error, request }) => {
      if (code === 'VALIDATION' || code === 'NOT_FOUND') return
      ctx.log.error({ method: request.method, url: request.url, code }, 'request failed', error)
    })

/** Imported by the web app for an end-to-end typed Eden Treaty client. */
export type App = ReturnType<typeof createApp>
