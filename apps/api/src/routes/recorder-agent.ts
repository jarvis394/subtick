import { eq, schema } from '@subtick/db'
import { RECORDER_STATES } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { hashRecorderToken } from '../services/recorders'

const { recorder } = schema

const Heartbeat = z.object({
  state: z.enum(RECORDER_STATES),
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
export const recorderAgentRoutes = ({ db }: Context) =>
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

        return { name: self.name, paused: self.paused }
      },
      { recorderToken: true, body: Heartbeat },
    )
