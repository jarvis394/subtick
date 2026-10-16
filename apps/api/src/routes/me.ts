import { eq, schema } from '@subtick/db'
import { Elysia } from 'elysia'
import type { Context } from '../context'
import { authGuard } from './guard'

export const meRoutes = ({ db, auth }: Context) =>
  new Elysia().use(authGuard(auth)).get(
    '/me',
    async ({ user }) => {
      const links = await db
        .select()
        .from(schema.steamLink)
        .where(eq(schema.steamLink.userId, user.id))
        .orderBy(schema.steamLink.createdAt)

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          isAdmin: user.role === 'admin',
        },
        steamLinks: links.map((link) => ({
          steamId: link.steamId,
          personaName: link.personaName,
          avatarUrl: link.avatarUrl,
          syncState: link.syncState,
          lastError: link.lastError,
          lastSyncedAt: link.lastSyncedAt,
          lastShareCode: link.lastShareCode,
          hasMatchAuth: link.authCode !== null && link.lastShareCode !== null,
        })),
      }
    },
    { auth: true },
  )
