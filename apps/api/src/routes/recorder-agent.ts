import { and, eq, schema } from '@subtick/db'
import { RECORDER_STATES, STEAM_MODES } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { hashRecorderToken } from '../services/recorders'

const { recorder, recorderSteamAccount: account } = schema

const Heartbeat = z.object({
  state: z.enum(RECORDER_STATES),
  signedInAs: z.string().max(64).nullable(),
  /** Optional: recorders built before Steam emulation don't send it. */
  steamMode: z.enum(STEAM_MODES).optional(),
  currentMatchId: z.string().max(32).nullable(),
  lastError: z.string().max(2000).nullable(),
  hostname: z.string().max(255).nullable(),
  gpu: z.string().max(255).nullable(),
  version: z.string().max(64).nullable(),
  clipsRecorded: z.number().int().min(0),
  startedAt: z.coerce.date(),
})

/**
 * What recorder machines call, authenticated with their `Authorization: Bearer <token>`. They
 * report health and learn their settings; recording work itself still comes through the queue.
 */
export const recorderAgentRoutes = ({ db, secrets }: Context) =>
  new Elysia({ prefix: '/recorder' })
    .macro({
      recorderToken: {
        async resolve({ status, request }) {
          const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
          if (!token) return status(401, { error: 'unauthorized' as const })
          const [row] = await db
            .select()
            .from(recorder)
            .where(eq(recorder.tokenHash, hashRecorderToken(token)))
          if (!row) return status(401, { error: 'unauthorized' as const })
          return { recorder: row }
        },
      },
    })
    .post(
      '/heartbeat',
      async ({ recorder: self, body }) => {
        await db
          .update(recorder)
          .set({ ...body, lastSeenAt: new Date() })
          .where(eq(recorder.id, self.id))
        // Hand a pending code over once. Only clear the one read here: an admin may just have
        // entered a newer one.
        if (self.guardCode)
          await db
            .update(recorder)
            .set({ guardCode: null })
            .where(and(eq(recorder.id, self.id), eq(recorder.guardCode, self.guardCode)))
        const [assigned] = self.steamAccountId
          ? await db
              .select({ username: account.username, updatedAt: account.updatedAt })
              .from(account)
              .where(eq(account.id, self.steamAccountId))
          : []
        return {
          name: self.name,
          paused: self.paused,
          /** Credentials come from `/steam-credentials`; `updatedAt` says when to refetch them. */
          steamAccount: assigned ?? null,
          guardCode: self.guardCode ? await secrets.decrypt(self.guardCode) : null,
        }
      },
      { recorderToken: true, body: Heartbeat },
    )
    .get(
      '/steam-credentials',
      async ({ recorder: self, status }) => {
        if (!self.steamAccountId) return status(404, { error: 'no_account' as const })
        const [row] = await db.select().from(account).where(eq(account.id, self.steamAccountId))
        if (!row) return status(404, { error: 'no_account' as const })
        return {
          username: row.username,
          password: await secrets.decrypt(row.password),
          sharedSecret: row.sharedSecret ? await secrets.decrypt(row.sharedSecret) : null,
        }
      },
      { recorderToken: true },
    )
