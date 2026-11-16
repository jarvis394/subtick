import { join } from 'node:path'
import { createWindowsHost } from './cs2/windows'
import { createWineHost } from './cs2/wine'
import { isWindows, localPath } from './platform'

/** Where `setup` installs on Windows unless WINDOWS_DIR says otherwise. */
export const DEFAULT_WINDOWS_DIR = 'C:\\subtick'

interface LayoutEnv {
  GAME_HOST?: 'wine' | 'windows'
  WINDOWS_DIR?: string
  CS2_DIR?: string
  WINEPREFIX: string
}

/** Where the recorder's game side lives, as this process reaches it. */
export const resolveLayout = (env: LayoutEnv) => {
  const gameHost = env.GAME_HOST ?? (isWindows ? 'windows' : 'wine')
  if (isWindows && gameHost === 'wine') throw new Error('GAME_HOST=wine only works on Linux')
  /** Holds HLAE and our config: a folder on a Windows drive, or the prefix's drive C under Wine. */
  const root =
    gameHost === 'windows'
      ? localPath(env.WINDOWS_DIR ?? DEFAULT_WINDOWS_DIR)
      : join(env.WINEPREFIX, 'drive_c')
  const cs2Dir = env.CS2_DIR
    ? localPath(env.CS2_DIR)
    : gameHost === 'windows'
      ? join(root, 'cs2')
      : '/cs2'

  return {
    gameHost,
    root,
    cs2Dir,
    hlaeDir: join(root, 'hlae'),
    /** HLAE's `USRLOCALCSGO`: our cfg folder, kept apart from the game's own settings. */
    configDir: join(root, 'subtick'),
  }
}

export type Layout = ReturnType<typeof resolveLayout>

export const createHost = (layout: Layout, prefix: string) =>
  layout.gameHost === 'windows'
    ? createWindowsHost([layout.root, layout.cs2Dir])
    : createWineHost(prefix)
