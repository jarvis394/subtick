import { DatabaseEnv, RedisEnv, S3Env, SecretsEnv, SteamEnv, loadEnv } from '@subtick/config'
import { z } from 'zod'

export const env = loadEnv({
  ...DatabaseEnv,
  ...RedisEnv,
  ...S3Env,
  ...SteamEnv,
  ...SecretsEnv,
  API_PORT: z.coerce.number().int().default(3000),
  /** Origin the browser sees. The web app proxies /api to this server, so cookies are first-party. */
  PUBLIC_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
})

export type Env = typeof env
