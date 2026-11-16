import { join } from 'node:path'
import cs2Video from '../cfg/cs2_video.txt' with { type: 'file' }
import subtickCfg from '../cfg/subtick.cfg' with { type: 'file' }
import gbeMain from '../gbe/steam_settings/configs.main.ini' with { type: 'file' }
import gbeUser from '../gbe/steam_settings/configs.user.ini' with { type: 'file' }
import gbeAppId from '../gbe/steam_settings/steam_appid.txt' with { type: 'file' }

/**
 * Files that ship inside the executable, by the name they are installed under. From source they
 * are read from the repo, compiled from the executable itself.
 */
export const assets = {
  cfg: { 'cs2_video.txt': cs2Video, 'subtick.cfg': subtickCfg },
  steamSettings: {
    'configs.main.ini': gbeMain,
    'configs.user.ini': gbeUser,
    'steam_appid.txt': gbeAppId,
  },
}

/** Writes a set of assets into `dir`. */
export const installAssets = async (files: Record<string, string>, dir: string) => {
  for (const [name, path] of Object.entries(files))
    // oxlint-disable-next-line no-await-in-loop -- a handful of small files
    await Bun.write(join(dir, name), Bun.file(path))
}
