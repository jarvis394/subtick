import { LogEnv, loadEnv } from '@subtick/config'
import { Logger } from 'tslog'

const env = loadEnv(LogEnv)

const root = new Logger({ name: 'subtick', type: env.LOG_FORMAT, minLevel: env.LOG_LEVEL })

/**
 * Named logger for a service or module. Prefer fields-first calls so JSON output stays queryable:
 * `log.info({ matchId, ms }, 'parsed')`.
 */
export const createLogger = (name: string) => root.getSubLogger({ name })

export type { Logger }
