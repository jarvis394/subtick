import { eq, schema } from '@subtick/db'
import { RECORDER_STATES } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import * as jobs from '../services/recorder-jobs'
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
  // Optional: recorders older than these fields still report.
  failStreak: z.number().int().min(0).default(0),
  hlaeVersion: z.string().max(32).nullable().default(null),
  hlaePovRelease: z.string().max(128).nullable().default(null),
  startedAt: z.coerce.date(),
})

const MatchId = z.string().min(1).max(32)
const HighlightIds = z.array(z.uuid()).max(500)
const HighlightParams = z.object({ id: z.uuid() })
const ErrorText = z.string().max(2000)

/**
 * What recorder machines call, authenticated with their `Authorization: Bearer <token>`. They
 * report health and learn their settings, and read and write everything a recording job touches
 * here, so a recorder holds no database or bucket credentials. The jobs themselves still come
 * through the queue.
 */
export const recorderAgentRoutes = (ctx: Context) =>
  new Elysia({ prefix: '/recorder' })
    .macro({
      recorderToken: {
        async resolve({ status, request }) {
          const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
          if (!token) return status(401, { error: 'unauthorized' as const })
          const [row] = await ctx.db
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
        await ctx.db
          .update(recorder)
          .set({ ...body, lastSeenAt: new Date() })
          .where(eq(recorder.id, self.id))

        return { name: self.name, paused: self.paused, hlaeTarget: self.hlaeTarget }
      },
      { recorderToken: true, body: Heartbeat },
    )
    .post('/jobs/start', async ({ body }) => ({ job: await jobs.startRecording(ctx, body) }), {
      recorderToken: true,
      body: z.object({
        matchId: MatchId,
        highlightIds: HighlightIds,
        recorderVersion: z.number().int().min(0),
      }),
    })
    .post(
      '/jobs/finish',
      async ({ body }) => {
        await jobs.finishRecording(ctx, body.matchId)

        return { ok: true }
      },
      { recorderToken: true, body: z.object({ matchId: MatchId }) },
    )
    .post(
      '/jobs/failed',
      async ({ body }) => {
        await jobs.recordingFailed(ctx, body)

        return { ok: true }
      },
      {
        recorderToken: true,
        body: z.object({
          matchId: MatchId,
          highlightIds: HighlightIds,
          error: ErrorText,
          reason: ErrorText,
        }),
      },
    )
    .get(
      '/highlights/:id/queued',
      async ({ params }) => ({ queued: await jobs.isQueued(ctx, params.id) }),
      { recorderToken: true, params: HighlightParams },
    )
    .post('/highlights/:id/uploads', ({ params }) => jobs.clipUploads(ctx, params.id), {
      recorderToken: true,
      params: HighlightParams,
    })
    .post(
      '/highlights/:id/recorded',
      async ({ params, body, status }) => {
        if (!(await jobs.clipRecorded(ctx, params.id, body)))
          return status(409, { error: 'not_uploaded' as const })

        return { ok: true }
      },
      {
        recorderToken: true,
        params: HighlightParams,
        body: z.object({
          durationMs: z.number().int().min(0),
          width: z.number().int().min(1).max(16_384),
          height: z.number().int().min(1).max(16_384),
          recorderVersion: z.number().int().min(0),
        }),
      },
    )
    .post(
      '/highlights/:id/failed',
      async ({ params, body }) => {
        await jobs.clipFailed(ctx, params.id, body.error)

        return { ok: true }
      },
      { recorderToken: true, params: HighlightParams, body: z.object({ error: ErrorText }) },
    )
