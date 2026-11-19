import { asc, inArray, schema } from '@subtick/db'
import { isPlaceholderEmail } from '@subtick/domain'
import type { Context } from '../context'
import { isApprovedUser } from '../routes/guard'
import { imageUrl } from './profile-images'

/**
 * The accounts signed in to this browser, in the order they were added, so switching never
 * reorders them. Each carries the session token that makes it the active one.
 */
export const listAccounts = async (
  ctx: Pick<Context, 'auth' | 'db' | 'clips'>,
  headers: Headers,
  active: { userId: string; token: string; createdAt: Date; pending: boolean },
) => {
  const { db } = ctx
  const device = await ctx.auth.api.listDeviceSessions({ headers }).catch(() => [])
  const sessions = device.map((s) => ({
    userId: s.user.id,
    token: s.session.token,
    createdAt: new Date(s.session.createdAt),
    pending: !isApprovedUser(s.user),
  }))
  // Sessions from before multi-session have no cookie of their own until adopted.
  if (!sessions.some((s) => s.userId === active.userId)) sessions.push(active)
  const ids = sessions.map((s) => s.userId)

  const [users, links] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        avatarKey: schema.user.avatarKey,
      })
      .from(schema.user)
      .where(inArray(schema.user.id, ids)),
    db
      .select({
        userId: schema.steamLink.userId,
        steamId: schema.steamLink.steamId,
        avatarUrl: schema.steamLink.avatarUrl,
      })
      .from(schema.steamLink)
      .where(inArray(schema.steamLink.userId, ids))
      .orderBy(asc(schema.steamLink.createdAt)),
  ])
  const userById = new Map(users.map((u) => [u.id, u]))

  return sessions
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .flatMap((s) => {
      const user = userById.get(s.userId)
      if (!user) return []
      const own = links.filter((l) => l.userId === user.id)

      return [
        {
          id: user.id,
          name: user.name,
          /** Null for Steam-only accounts, whose email is a placeholder. */
          email: isPlaceholderEmail(user.email) ? null : user.email,
          avatarUrl: imageUrl(ctx, user.avatarKey) ?? own[0]?.avatarUrl ?? user.image ?? null,
          steamIds: own.map((l) => l.steamId),
          sessionToken: s.token,
          active: s.userId === active.userId,
          /** Awaiting approval: switching to it shows only the waiting screen. */
          pending: s.pending,
        },
      ]
    })
}

export type Account = Awaited<ReturnType<typeof listAccounts>>[number]
