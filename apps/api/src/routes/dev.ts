import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { devToolsEnabled } from '../services/dev-flag'
import { authGuard } from './guard'

/** The states a fake highlight can be added in; `simulate` plays a recorder's run. */
const FAKE_STATES = ['failed', 'recording', 'ready', 'simulate'] as const

// The services load on first use, so only a dev build ever reads them.
const matches = () => import('../services/dev-matches')
const highlights = () => import('../services/dev-highlights')

/** Local-only helpers behind the web app's dev menu; 404 anywhere else. */
export const devRoutes = (ctx: Context) => {
  const enabled = devToolsEnabled(ctx.env)
  return new Elysia({ prefix: '/dev' })
    .use(authGuard(ctx.auth))
    .get(
      '/matches',
      async ({ user, status }) =>
        enabled ? (await matches()).listFakeMatches(ctx.db, user.id) : status(404, { error: 'not_found' as const }),
      { auth: true },
    )
    .post(
      '/matches',
      async ({ user, status }) =>
        enabled ? (await matches()).stageFakeMatch(user.id) : status(404, { error: 'not_found' as const }),
      { auth: true },
    )
    .delete(
      '/matches/:id',
      async ({ user, params, status }) => {
        if (!enabled || !(await (await matches()).deleteFakeMatch(ctx.db, user.id, params.id))) {
          return status(404, { error: 'not_found' as const })
        }
        return { ok: true as const }
      },
      { auth: true, params: z.object({ id: z.string().regex(/^\d+$/) }) },
    )
    .get(
      '/highlights',
      async ({ query, status }) =>
        enabled
          ? (await highlights()).listFakeHighlights(ctx.db, query.matchId)
          : status(404, { error: 'not_found' as const }),
      { auth: true, query: z.object({ matchId: z.string().regex(/^\d+$/) }) },
    )
    .post(
      '/highlights',
      async ({ user, body, status }) => {
        if (!enabled) return status(404, { error: 'not_found' as const })
        const dev = await highlights()
        const added =
          body.state === 'simulate'
            ? await dev.simulateRecording(ctx.db, ctx.publish, user.id, body.matchId)
            : await dev.addFakeHighlight(ctx.db, user.id, body.matchId, body.state)
        return 'error' in added ? status(400, added) : added
      },
      {
        auth: true,
        body: z.object({ matchId: z.string().regex(/^\d+$/), state: z.enum(FAKE_STATES) }),
      },
    )
    .delete(
      '/highlights/:id',
      async ({ params, status }) => {
        if (!enabled || !(await (await highlights()).deleteFakeHighlight(ctx.db, params.id))) {
          return status(404, { error: 'not_found' as const })
        }
        return { ok: true as const }
      },
      { auth: true, params: z.object({ id: z.uuid() }) },
    )
}
