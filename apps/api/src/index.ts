import { closeOnSignal } from '@subtick/queue'
import { createApp } from './app'
import { createContext } from './context'
import { env } from './env'

const ctx = await createContext(env)
const app = createApp(ctx).listen(env.API_PORT)

closeOnSignal(...Object.values(ctx.queues), { close: async () => void (await app.stop()) })
ctx.log.info({ port: env.API_PORT, publicUrl: env.PUBLIC_URL }, 'api listening')

if (!env.STEAM_API_KEY)
  ctx.log.warn('STEAM_API_KEY is not set: Steam sign-in and profile lookups will fail')
