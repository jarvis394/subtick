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
  /** Sends email-confirmation links. Unset: they're only logged (local development). */
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  /** Sender on a domain verified in Resend. */
  MAIL_FROM: z.string().default('subtick <noreply@subtick.invalid>'),
})

export type Env = typeof env
