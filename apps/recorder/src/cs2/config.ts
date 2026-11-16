import { cp } from 'node:fs/promises'
import { join } from 'node:path'

export interface Resolution {
  width: number
  height: number
}

const setting = (text: string, name: string, value: number) =>
  text.replace(new RegExp(`("setting\\.${name}"\\s+)"\\d+"`), `$1"${value}"`)

/** Copies `cfg/` into HLAE's `USRLOCALCSGO` with the capture size written into the video settings. */
export const installConfig = async (configDir: string, { width, height }: Resolution) => {
  const cfgDir = join(configDir, 'cfg')
  await cp(new URL('../../cfg', import.meta.url).pathname, cfgDir, { recursive: true })

  const video = Bun.file(join(cfgDir, 'cs2_video.txt'))
  const text = await video.text()
  await Bun.write(video, setting(setting(text, 'defaultres', width), 'defaultresheight', height))
}
