import { Elysia } from 'elysia'
import type { Auth } from '../auth'

/** `{ auth: true }` on a route resolves `user` or responds 401. */
export const authGuard = (auth: Auth) =>
  new Elysia({ name: 'auth-guard' }).macro({
    auth: {
      async resolve({ status, request }) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return status(401, { error: 'unauthorized' as const })
        return { user: session.user }
      },
    },
  })
