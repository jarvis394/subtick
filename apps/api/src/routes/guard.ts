import { Elysia } from 'elysia'
import type { Auth } from '../auth'

/**
 * `{ auth: true }` on a route resolves `user` or responds 401.
 * `{ admin: true }` also requires the admin role, or responds 403.
 */
export const authGuard = (auth: Auth) =>
  new Elysia({ name: 'auth-guard' }).macro({
    auth: {
      async resolve({ status, request }) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return status(401, { error: 'unauthorized' as const })
        return { user: session.user }
      },
    },
    admin: {
      async resolve({ status, request }) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return status(401, { error: 'unauthorized' as const })
        if (session.user.role !== 'admin') return status(403, { error: 'forbidden' as const })
        return { user: session.user }
      },
    },
  })
