import { isApproved } from '@subtick/domain'
import { Elysia } from 'elysia'
import type { Auth } from '../auth'

/**
 * `{ auth: true }` on a route resolves an approved `user`, or responds 401 (signed out) or 403
 * `pending_approval`. `{ signedIn: true }` lets accounts awaiting approval through too.
 * `{ admin: true }` also requires the admin role, or responds 403.
 */
export const authGuard = (auth: Auth) => {
  const sessionUser = async (request: Request) =>
    (await auth.api.getSession({ headers: request.headers }))?.user

  return new Elysia({ name: 'auth-guard' }).macro({
    signedIn: {
      async resolve({ status, request }) {
        const user = await sessionUser(request)
        if (!user) return status(401, { error: 'unauthorized' as const })

        return { user }
      },
    },
    auth: {
      async resolve({ status, request }) {
        const user = await sessionUser(request)
        if (!user) return status(401, { error: 'unauthorized' as const })
        if (!isApproved(user)) return status(403, { error: 'pending_approval' as const })

        return { user }
      },
    },
    admin: {
      async resolve({ status, request }) {
        const user = await sessionUser(request)
        if (!user) return status(401, { error: 'unauthorized' as const })
        if (user.role !== 'admin') return status(403, { error: 'forbidden' as const })

        return { user }
      },
    },
  })
}
