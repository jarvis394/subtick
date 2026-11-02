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
  /** Public origin of the S3 gateway for presigned URLs, when browsers can't reach S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_DEMOS: z.string().default('demos'),
  S3_BUCKET_CLIPS: z.string().default('clips'),
  /**
   * SeaweedFS volume server status (http://<host>:8080/status), for the disk's size and free space
   * on the admin Storage page. Unset: the page shows only what subtick's own data takes.
   */
  S3_DISK_STATUS_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
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
 * The recorder runs CS2 (Windows build) under Wine on gbe_fork's Steam emulator, injects HLAE and
 * drives it over the netcon console. Paths are as seen from the recorder's container.
 */
export const RecorderEnv = {
  /** CS2 install root, the folder that holds `game/`. */
  CS2_DIR: z.string().default('/cs2'),
  /**
   * CS2_SOURCE=server: the dedicated-server install the game files link into. The recorder
   * restarts when it updates past the Windows binaries, so the bootstrap fetches matching ones.
   */
  CS2_SERVER_DIR: z.string().optional(),
  /** Wine prefix with .NET, DXVK and HLAE (apps/recorder/docker/bootstrap.sh sets it up). */
  WINEPREFIX: z.string().default('/wine/pfx'),
  CS2_NETCON_PORT: z.coerce.number().int().default(2121),
  /**
   * Joins the instance's recorder fleet: the subtick origin (PUBLIC_URL) and the token an admin
   * got when adding this machine. The machine then reports its health and takes its settings from
   * there; without them it runs standalone.
   */
  SUBTICK_URL: z.url().optional(),
  RECORDER_TOKEN: z.string().startsWith('strec_').optional(),
  /**
   * 1: clips show the recorded player's own HUD instead of CS2's spectator HUD, through the
   * `mirv_pov` fork of HLAE's AfxHookSource2.dll (installed by the bootstrap).
   */
  HLAE_POV: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),
}

export const WorkerEnv = {
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  SCRATCH_DIR: z.string().default('/tmp/subtick'),
}
