import type { Env } from '../env'

/**
 * Dev tools (fake matches and highlights) are on only when the app is served from this machine, so
 * production can never expose them. Everything behind the flag is imported on demand: a
 * production process never even loads that code.
 */
export const devToolsEnabled = (env: Env) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.PUBLIC_URL).hostname)
