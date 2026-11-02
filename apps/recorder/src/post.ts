/** Turns a raw capture into what the web app plays: a small faststart MP4 and a WebP poster. */

const run = async (command: string[]) => {
  const proc = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if (code !== 0)
    throw new Error(`${command[0]} failed: ${stderr.trim().split('\n').slice(-3).join(' ')}`)

  return stdout
}

const ffmpeg = (...args: string[]) =>
  run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args])

export interface VideoInfo {
  durationMs: number
  width: number
  height: number
}

export const probe = async (path: string): Promise<VideoInfo> => {
  const out = await run([
    'ffprobe',
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    path,
  ])
  const json = JSON.parse(out) as {
    streams: { width: number; height: number }[]
    format: { duration: string }
  }
  const stream = json.streams[0]
  if (!stream) throw new Error(`${path} has no video stream`)

  return {
    durationMs: Math.round(Number(json.format.duration) * 1000),
    width: stream.width,
    height: stream.height,
  }
}

/**
 * Cuts the capture to the planned length (it can run a frame or two long) and muxes the game
 * audio in as AAC. The video stream is copied, never re-encoded.
 */
export const finishClip = (
  video: string,
  audio: string | undefined,
  output: string,
  maxSeconds: number,
) =>
  ffmpeg(
    '-i',
    video,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : []),
    '-t',
    maxSeconds.toFixed(3),
    '-c:v',
    'copy',
    '-movflags',
    '+faststart',
    output,
  )

/**
 * Plays finished parts back to back in one file. They come from the same capture settings, so
 * the streams are copied, never re-encoded.
 */
export const joinParts = async (parts: string[], output: string) => {
  if (parts.length === 1)
    return ffmpeg('-i', parts[0]!, '-c', 'copy', '-movflags', '+faststart', output)
  const list = `${output}.txt`
  // The concat demuxer's list escapes `'` as `'\''`.
  await Bun.write(list, parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'\n`).join(''))
  await ffmpeg(
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    output,
  )
}

export const thumbnail = async (input: string, output: string, atSeconds: number) => {
  // Past the end, ffmpeg writes nothing and still exits 0.
  const { durationMs } = await probe(input)
  const at = Math.min(Math.max(0, atSeconds), Math.max(0, durationMs / 1000 - 0.1))
  // Cards show it at most ~640 CSS px wide, so 1280 covers 2x screens; WebP is about a third
  // smaller than a JPEG of the same quality.
  await ffmpeg(
    '-ss',
    at.toFixed(3),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    "scale='min(1280,iw)':-2",
    '-c:v',
    'libwebp',
    '-quality',
    '80',
    output,
  )
  if (!(await Bun.file(output).exists()))
    throw new Error(`no frame at ${at}s in ${input} (${durationMs} ms long)`)
}
