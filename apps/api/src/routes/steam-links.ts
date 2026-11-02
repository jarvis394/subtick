import { and, eq, schema } from '@subtick/db'
import { isMatchAuthCode, isShareCode } from '@subtick/domain'
import { enqueue } from '@subtick/queue'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { STEAM_PROVIDER_ID } from '../auth/steam-plugin'
import type { Context } from '../context'
import { importShareCode } from '../services/matches'
import { authGuard } from './guard'

const MatchAuthBody = z.object({
  authCode: z.string().trim().toUpperCase().refine(isMatchAuthCode, 'Expected XXXX-XXXXX-XXXX'),
  shareCode: z.string().trim().refine(isShareCode, 'Expected CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx'),
})

export const steamLinkRoutes = (ctx: Context) => {
  const { db, auth, steamApi, secrets, queues } = ctx

  const findOwnLink = async (userId: string, steamId: string) => {
    const [link] = await db
      .select()
      .from(schema.steamLink)
      .where(and(eq(schema.steamLink.steamId, steamId), eq(schema.steamLink.userId, userId)))

    return link
  }

  return new Elysia({ prefix: '/steam-links' })
    .use(authGuard(auth))
    .put(
      '/:steamId/match-auth',
      async ({ user, params, body, status }) => {
        if (!(await findOwnLink(user.id, params.steamId)))
          return status(404, { error: 'not_found' as const })

        // Valve answers 403/412 when the auth code or the share code doesn't belong to this account.
        const check = await steamApi.getNextShareCode({
          steamId: params.steamId,
          authCode: body.authCode,
          knownCode: body.shareCode,
        })
        if (check.status === 'invalid_auth_code' || check.status === 'invalid_share_code') {
          return status(422, { error: check.status })
        }

        await db
          .update(schema.steamLink)
          .set({
            authCode: await secrets.encrypt(body.authCode),
            lastShareCode: body.shareCode,
            syncState: 'idle',
            lastError: null,
            nextSyncAt: new Date(),
          })
          .where(eq(schema.steamLink.steamId, params.steamId))

        // The code the user pasted is their latest match: import it right away, then sync newer ones.
        await importShareCode(ctx, {
          userId: user.id,
          steamId: params.steamId,
          shareCode: body.shareCode,
        })
        await enqueue(queues.syncUser, { steamId: params.steamId })

        return { ok: true as const }
      },
      { auth: true, body: MatchAuthBody, params: z.object({ steamId: z.string() }) },
    )
    .delete(
      '/:steamId',
      async ({ user, params, status }) => {
        if (!(await findOwnLink(user.id, params.steamId)))
          return status(404, { error: 'not_found' as const })

        // Don't let someone remove the only way they can sign in.
        const accounts = await db
          .select()
          .from(schema.account)
          .where(eq(schema.account.userId, user.id))
        if (accounts.length <= 1) return status(409, { error: 'last_sign_in_method' as const })

        await db.transaction(async (tx) => {
          await tx.delete(schema.steamLink).where(eq(schema.steamLink.steamId, params.steamId))
          await tx
            .delete(schema.account)
            .where(
              and(
                eq(schema.account.userId, user.id),
                eq(schema.account.providerId, STEAM_PROVIDER_ID),
                eq(schema.account.accountId, params.steamId),
              ),
            )
        })

        return { ok: true as const }
      },
      { auth: true, params: z.object({ steamId: z.string() }) },
    )
}
