import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

// Apps run from their own directory under turbo, so the repo-root .env is loaded explicitly.
// Variables already set in the environment win.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

/**
 * Validates `env` against a shape: applies defaults, coerces numbers and throws a readable error
 * listing every invalid variable. Call once at process start.
 *
 * Apps compose fragments: `loadEnv({ ...DatabaseEnv, ...RedisEnv })`.
 */
export const loadEnv = <T extends z.ZodRawShape>(
  shape: T,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const result = z.object(shape).safeParse(env)
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  return result.data
}

export const LogEnv = {
  LOG_LEVEL: z.enum(['SILLY', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).default('INFO'),
  /** `pretty` for local dev, `json` (one object per line) for log collectors. */
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
}
export const DatabaseEnv = { DATABASE_URL: z.url() }
export const RedisEnv = { REDIS_URL: z.url() }
export const S3Env = {
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_DEMOS: z.string().default('demos'),
  S3_BUCKET_CLIPS: z.string().default('clips'),
}
export const SteamEnv = {
  /** https://steamcommunity.com/dev/apikey */
  STEAM_API_KEY: z.string().min(1),
}
/**
 * Bot account the steam worker logs in with to ask the Game Coordinator for demo URLs. Optional:
 * without it, only matches imported with a demo URL can be downloaded. A shared secret (Steam
 * Guard mobile authenticator) avoids prompts; otherwise pass the emailed code once in
 * STEAM_BOT_GUARD_CODE and the refresh token saved after login is reused from then on.
 */
export const SteamBotEnv = {
  STEAM_BOT_USERNAME: z.string().min(1).optional(),
  STEAM_BOT_PASSWORD: z.string().min(1).optional(),
  STEAM_BOT_SHARED_SECRET: z.string().min(1).optional(),
  STEAM_BOT_GUARD_CODE: z.string().min(1).optional(),
}
/** 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts stored match auth codes. */
export const SecretsEnv = { SECRETS_KEY: z.base64().length(44) }
/**
 * The recorder runs CS2 (Windows build) under Wine next to a signed-in Steam client, injects HLAE
 * and drives it over the netcon console. Paths are as seen from the recorder's container.
 */
export const RecorderEnv = {
  /** CS2 install root, the folder that holds `game/`. */
  CS2_DIR: z.string().default('/cs2'),
  /** Wine prefix with Steam, .NET and HLAE (apps/recorder/docker/bootstrap.sh sets it up). */
  WINEPREFIX: z.string().default('/wine/pfx'),
  CS2_NETCON_PORT: z.coerce.number().int().default(2121),
  /**
   * Joins the instance's recorder fleet: the subtick origin (PUBLIC_URL) and the token an admin
   * got when adding this machine. The machine then reports its health and takes its Steam account
   * from there; without them it runs standalone with the STEAM_* variables below.
   */
  SUBTICK_URL: z.url().optional(),
  RECORDER_TOKEN: z.string().startsWith('strec_').optional(),
  /**
   * Standalone only: Steam account the game client signs in with, only needed until the first sign-in
   * (the prefix keeps a token). Use a dedicated account: one account can't run CS2 here and play
   * elsewhere, or be the steam worker's bot, at the same time.
   */
  STEAM_USERNAME: z.string().min(1).optional(),
  STEAM_PASSWORD: z.string().min(1).optional(),
  STEAM_SHARED_SECRET: z.string().min(1).optional(),
}
export const WorkerEnv = {
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  SCRATCH_DIR: z.string().default('/tmp/subtick'),
}
