import { asc, eq, schema } from '@subtick/db'
import { USER_ROLES } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { newRecorderToken, recorderView } from '../services/recorders'
import { authGuard } from './guard'

const { user, recorder, recorderSteamAccount: account } = schema

/** better-auth user ids are opaque strings; recorders and accounts use uuids. */
const UserId = z.object({ id: z.string() })
const Id = z.object({ id: z.uuid() })
const Name = z.string().trim().min(1).max(64)
const Secret = z.string().min(1).max(256)
const SharedSecret = z
  .string()
  .trim()
  .refine((value) => Buffer.from(value, 'base64').length === 20, 'Expected a base64 shared secret')

/**
 * Postgres unique violation: a duplicate username or an account already assigned elsewhere.
 * Drizzle wraps the driver's error in `cause`.
 */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (('errno' in error && error.errno === '23505') ||
    ('cause' in error && isUniqueViolation(error.cause)))

/**
 * Instance administration: users' roles, recorder machines and the Steam accounts they play with.
 * Every route needs the admin role.
 */
export const adminRoutes = (ctx: Context) => {
  const { db, auth, secrets } = ctx

  const listRecorders = async () => {
    const rows = await db
      .select({ recorder, account: { id: account.id, username: account.username } })
      .from(recorder)
      .leftJoin(account, eq(account.id, recorder.steamAccountId))
      .orderBy(asc(recorder.createdAt))
    return rows.map((row) => recorderView(row.recorder, row.account))
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
          try {
            const [row] = await db
              .update(recorder)
              .set({
                name: body.name,
                paused: body.paused,
                // A pending code belongs to the account being replaced.
                ...(body.steamAccountId !== undefined && {
                  steamAccountId: body.steamAccountId,
                  guardCode: null,
                }),
              })
              .where(eq(recorder.id, params.id))
              .returning({ id: recorder.id })
            if (!row) return status(404, { error: 'not_found' as const })
          } catch (error) {
            if (isUniqueViolation(error)) return status(409, { error: 'account_in_use' as const })
            throw error
          }
          return { ok: true as const }
        },
        {
          admin: true,
          params: Id,
          body: z.object({
            name: Name.optional(),
            paused: z.boolean().optional(),
            steamAccountId: z.uuid().nullable().optional(),
          }),
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
      .post(
        '/recorders/:id/guard-code',
        async ({ params, body, status }) => {
          const [row] = await db
            .update(recorder)
            .set({ guardCode: await secrets.encrypt(body.code) })
            .where(eq(recorder.id, params.id))
            .returning({ id: recorder.id })
          if (!row) return status(404, { error: 'not_found' as const })
          return { ok: true as const }
        },
        {
          admin: true,
          params: Id,
          body: z.object({
            code: z
              .string()
              .trim()
              .toUpperCase()
              .regex(/^[A-Z0-9]{5}$/, 'Expected the 5-character code'),
          }),
        },
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

      // Steam accounts for recorders. Secrets go in, never out.
      .get(
        '/steam-accounts',
        async () => {
          const rows = await db
            .select({ account, recorderId: recorder.id, recorderName: recorder.name })
            .from(account)
            .leftJoin(recorder, eq(recorder.steamAccountId, account.id))
            .orderBy(asc(account.username))
          return rows.map((row) => ({
            id: row.account.id,
            username: row.account.username,
            note: row.account.note,
            hasSharedSecret: row.account.sharedSecret !== null,
            recorder: row.recorderId ? { id: row.recorderId, name: row.recorderName! } : null,
            updatedAt: row.account.updatedAt,
          }))
        },
        { admin: true },
      )
      .post(
        '/steam-accounts',
        async ({ body, status }) => {
          try {
            const [row] = await db
              .insert(account)
              .values({
                username: body.username,
                password: await secrets.encrypt(body.password),
                sharedSecret: body.sharedSecret ? await secrets.encrypt(body.sharedSecret) : null,
                note: body.note || null,
              })
              .returning({ id: account.id })
            return { id: row!.id }
          } catch (error) {
            if (isUniqueViolation(error)) return status(409, { error: 'username_taken' as const })
            throw error
          }
        },
        {
          admin: true,
          body: z.object({
            username: z.string().trim().min(1).max(64),
            password: Secret,
            sharedSecret: SharedSecret.optional(),
            note: z.string().trim().max(200).optional(),
          }),
        },
      )
      .patch(
        '/steam-accounts/:id',
        async ({ params, body, status }) => {
          const [row] = await db
            .update(account)
            .set({
              ...(body.password && { password: await secrets.encrypt(body.password) }),
              ...(body.sharedSecret !== undefined && {
                sharedSecret: body.sharedSecret ? await secrets.encrypt(body.sharedSecret) : null,
              }),
              ...(body.note !== undefined && { note: body.note || null }),
            })
            .where(eq(account.id, params.id))
            .returning({ id: account.id })
          if (!row) return status(404, { error: 'not_found' as const })
          return { ok: true as const }
        },
        {
          admin: true,
          params: Id,
          body: z.object({
            password: Secret.optional(),
            /** `null` removes the secret. */
            sharedSecret: SharedSecret.nullable().optional(),
            note: z.string().trim().max(200).optional(),
          }),
        },
      )
      .delete(
        '/steam-accounts/:id',
        async ({ params, status }) => {
          const [row] = await db
            .delete(account)
            .where(eq(account.id, params.id))
            .returning({ id: account.id })
          if (!row) return status(404, { error: 'not_found' as const })
          return { ok: true as const }
        },
        { admin: true, params: Id },
      )
  )
}
