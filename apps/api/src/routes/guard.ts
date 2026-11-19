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

// better-auth's multi-session types leave out additional fields, though it returns them.
export const isApprovedUser = (user: object) => isApproved(user as Parameters<typeof isApproved>[0])

/**
 * Everyone signed in to this browser who may use the app, the active user first. The rest come
 * from multi-session cookies, which better-auth verifies against live sessions.
 */
export const connectedUserIds = async (auth: Auth, headers: Headers, activeId: string) => {
  const sessions = await auth.api.listDeviceSessions({ headers }).catch(() => [])
  const others = sessions
    .map((s) => s.user)
    .filter((u) => u.id !== activeId && isApprovedUser(u))
    .map((u) => u.id)

  return [activeId, ...new Set(others)]
}
