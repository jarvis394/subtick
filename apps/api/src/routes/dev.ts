import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import {
  deleteFakeMatch,
  devToolsEnabled,
  listFakeMatches,
  stageFakeMatch,
} from '../services/dev-matches'
import { authGuard } from './guard'

/** Local-only helpers behind the web app's dev menu; 404 anywhere else. */
export const devRoutes = (ctx: Context) => {
  const enabled = devToolsEnabled(ctx.env)
  return new Elysia({ prefix: '/dev' })
    .use(authGuard(ctx.auth))
    .get(
      '/matches',
      async ({ user, status }) =>
        enabled ? listFakeMatches(ctx.db, user.id) : status(404, { error: 'not_found' as const }),
      { auth: true },
    )
    .post(
      '/matches',
      ({ user, status }) =>
        enabled ? stageFakeMatch(user.id) : status(404, { error: 'not_found' as const }),
      { auth: true },
    )
    .delete(
      '/matches/:id',
      async ({ user, params, status }) => {
        if (!enabled || !(await deleteFakeMatch(ctx.db, user.id, params.id))) {
          return status(404, { error: 'not_found' as const })
        }
        return { ok: true as const }
      },
      { auth: true, params: z.object({ id: z.string().regex(/^\d+$/) }) },
    )
}
