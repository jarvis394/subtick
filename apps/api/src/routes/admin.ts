import { asc, eq, schema } from '@subtick/db'
import { USER_ROLES } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { newRecorderToken, recorderView } from '../services/recorders'
import { createStorageReport } from '../services/storage'
import {
  deleteRecordedHighlight,
  deleteStoredMatch,
  listRecordedHighlights,
  listStoredMatches,
} from '../services/storage-items'
import { authGuard } from './guard'

const { user, recorder } = schema

/** better-auth user ids are opaque strings; recorders use uuids. */
const UserId = z.object({ id: z.string() })
const Id = z.object({ id: z.uuid() })
/** Valve's match ids: a 64-bit number in decimal. */
const MatchId = z.object({ id: z.string().regex(/^\d{1,20}$/) })
const Name = z.string().trim().min(1).max(64)

/** Instance administration: users' roles, recorder machines and storage. Every route needs the admin role. */
export const adminRoutes = (ctx: Context) => {
  const { db, auth } = ctx

  const storage = createStorageReport(ctx)

  const listRecorders = async () => {
    const rows = await db.select().from(recorder).orderBy(asc(recorder.createdAt))

    return rows.map(recorderView)
  }

  return (
    new Elysia({ prefix: '/admin' })
      .use(authGuard(auth))

      // Users and roles
      .get(
        '/users',
        async () =>
          db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              role: user.role,
              createdAt: user.createdAt,
            })
            .from(user)
            .orderBy(asc(user.createdAt)),
        { admin: true },
      )
      .patch(
        '/users/:id',
        async ({ user: me, params, body, status }) => {
          // Demoting yourself could leave the instance without an admin; ask another admin.
          if (params.id === me.id) return status(409, { error: 'cannot_change_own_role' as const })
          const [row] = await db
            .update(user)
            .set({ role: body.role })
            .where(eq(user.id, params.id))
            .returning({ id: user.id })
          if (!row) return status(404, { error: 'not_found' as const })

          return { ok: true as const }
        },
        { admin: true, params: UserId, body: z.object({ role: z.enum(USER_ROLES) }) },
      )

      // Storage
      .get('/storage', () => storage.report(), { admin: true })
      .get('/storage/highlights', async () => listRecordedHighlights(ctx, await storage.sizes()), {
        admin: true,
      })
      .delete(
        '/storage/highlights/:id',
        async ({ params, status }) => {
          const result = await deleteRecordedHighlight(ctx, params.id)
          if (result === 'not_found') return status(404, { error: 'not_found' as const })
          if (result === 'recording') return status(409, { error: 'recording' as const })
          storage.invalidate()

          return { ok: true as const }
        },
        { admin: true, params: Id },
      )
      .get('/storage/matches', async () => listStoredMatches(ctx, await storage.sizes()), {
        admin: true,
      })
      .delete(
        '/storage/matches/:id',
        async ({ params, status }) => {
          const result = await deleteStoredMatch(ctx, params.id)
          if (result === 'not_found') return status(404, { error: 'not_found' as const })
          if (result === 'processing') return status(409, { error: 'processing' as const })
          storage.invalidate()

          return { ok: true as const }
        },
        { admin: true, params: MatchId },
      )

      // Recorders
      .get('/recorders', listRecorders, { admin: true })
      .post(
        '/recorders',
        async ({ user: me, body }) => {
          const { token, tokenHash, tokenHint } = newRecorderToken()
          const [row] = await db
            .insert(recorder)
            .values({ name: body.name, tokenHash, tokenHint, createdBy: me.id })
            .returning({ id: recorder.id })

          return { id: row!.id, token }
        },
        { admin: true, body: z.object({ name: Name }) },
      )
      .patch(
        '/recorders/:id',
        async ({ params, body, status }) => {
          const [row] = await db
            .update(recorder)
            .set({ name: body.name, paused: body.paused })
            .where(eq(recorder.id, params.id))
            .returning({ id: recorder.id })
          if (!row) return status(404, { error: 'not_found' as const })

          return { ok: true as const }
        },
        {
          admin: true,
          params: Id,
          body: z.object({ name: Name.optional(), paused: z.boolean().optional() }),
        },
      )
      .post(
        '/recorders/:id/token',
        async ({ params, status }) => {
          const { token, tokenHash, tokenHint } = newRecorderToken()
          const [row] = await db
            .update(recorder)
            .set({ tokenHash, tokenHint })
            .where(eq(recorder.id, params.id))
            .returning({ id: recorder.id })
          if (!row) return status(404, { error: 'not_found' as const })

          return { id: row.id, token }
        },
        { admin: true, params: Id },
      )
      .delete(
        '/recorders/:id',
        async ({ params, status }) => {
          const [row] = await db
            .delete(recorder)
            .where(eq(recorder.id, params.id))
            .returning({ id: recorder.id })
          if (!row) return status(404, { error: 'not_found' as const })

          return { ok: true as const }
        },
        { admin: true, params: Id },
      )
  )
}
