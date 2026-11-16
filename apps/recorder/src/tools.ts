import { delimiter } from 'node:path'
import { toolsDir } from './platform'

/** A program the worker runs itself (ffmpeg, ffprobe): the one `setup` installed, else the system's. */
export const tool = (name: string) =>
  Bun.which(name, { PATH: [toolsDir(), process.env.PATH].filter(Boolean).join(delimiter) }) ?? name
