import { Elysia } from 'elysia'
import type { Context } from '../context'
import { actorOf } from '../services/matches'
import { listQueue } from '../services/queue'
import { authGuard } from './guard'

/** The instance's pipeline work, for the Queue page. */
export const queueRoutes = (ctx: Context) =>
  new Elysia({ prefix: '/queue' })
    .use(authGuard(ctx.auth))
    .get('/', ({ user }) => listQueue(ctx, actorOf(user)), { auth: true })
