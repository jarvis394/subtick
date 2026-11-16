import { basename } from 'node:path'

/** Set by `scripts/compile.ts` through `--define`; absent when run from source. */
declare const SUBTICK_RECORDER_VERSION: string | undefined

export const VERSION =
  typeof SUBTICK_RECORDER_VERSION === 'string' ? SUBTICK_RECORDER_VERSION : '0.0.0-dev'

/** A compiled executable runs its code from Bun's embedded filesystem. */
export const isCompiled = /\$bunfs|~BUN/.test(import.meta.path)

/** How to run this program again, for hints. */
export const self = isCompiled ? basename(process.execPath) : 'bun apps/recorder/src/cli.ts'
