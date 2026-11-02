import { and, eq, schema } from '@subtick/db'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import {
  IMAGE_LIMITS,
  IMAGE_TYPES,
  type ProfileImage,
  imageUrl,
  replaceImage,
} from '../services/profile-images'
import { authGuard } from './guard'

const ProfileBody = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(32, 'Keep it under 32 characters'),
})

const ImageBody = z.object({ file: z.instanceof(File) })
const ImageParams = z.object({ kind: z.enum(['avatar', 'banner']) })

export const meRoutes = (ctx: Context) => {
  const { db, auth } = ctx

  return new Elysia()
    .use(authGuard(auth))
    .get(
      '/me',
      async ({ user }) => {
        const [links, [credential], [row]] = await Promise.all([
          db
            .select()
            .from(schema.steamLink)
            .where(eq(schema.steamLink.userId, user.id))
            .orderBy(schema.steamLink.createdAt),
          db
            .select({ id: schema.account.id })
            .from(schema.account)
            .where(
              and(eq(schema.account.userId, user.id), eq(schema.account.providerId, 'credential')),
            ),
          db
            .select({ avatarKey: schema.user.avatarKey, bannerKey: schema.user.bannerKey })
            .from(schema.user)
            .where(eq(schema.user.id, user.id)),
        ])
        const uploadedAvatar = imageUrl(ctx, row?.avatarKey ?? null)

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
            /** The uploaded picture, else the first Steam account's, else better-auth's. */
            avatarUrl: uploadedAvatar ?? links[0]?.avatarUrl ?? user.image ?? null,
            hasUploadedAvatar: uploadedAvatar !== null,
            bannerUrl: imageUrl(ctx, row?.bannerKey ?? null),
            isAdmin: user.role === 'admin',
            /** False for Steam-only accounts, whose email is a placeholder. */
            hasPassword: credential !== undefined,
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
    .patch(
      '/me/profile',
      async ({ user, body }) => {
        // The display name only: Steam persona names stay as Steam reports them.
        await db.update(schema.user).set({ name: body.name }).where(eq(schema.user.id, user.id))

        return { name: body.name }
      },
      { auth: true, body: ProfileBody },
    )
    .put(
      '/me/images/:kind',
      async ({ user, params, body, status }) => {
        const kind: ProfileImage = params.kind
        if (!IMAGE_TYPES.includes(body.file.type))
          return status(415, { error: 'unsupported_type' as const })
        if (body.file.size > IMAGE_LIMITS[kind].maxBytes)
          return status(413, { error: 'too_large' as const })

        return { url: await replaceImage(ctx, user.id, kind, body.file) }
      },
      { auth: true, params: ImageParams, body: ImageBody },
    )
    .delete(
      '/me/images/:kind',
      async ({ user, params }) => ({ url: await replaceImage(ctx, user.id, params.kind, null) }),
      { auth: true, params: ImageParams },
    )
}
