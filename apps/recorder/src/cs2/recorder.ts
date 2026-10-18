/* oxlint-disable no-await-in-loop -- segments render one after another; polls for HLAE's file */
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type ClipSegment, segmentsTicks } from '@subtick/domain'
import type { Logger } from '@subtick/logger'
import type { ClipPlan, MatchToRecord, RecordedFile, RecordedPart, Recorder } from '../recorder'
import type { NetCon } from './netcon'
import { type WineGame, findProcesses, windowsPath } from './wine'

const TICKRATE = 64
/**
 * Seek this far before a clip. Switching the spectated player makes CS2 re-sync with a demo
 * skip about two demo seconds later; that has to land before the start trigger, or the skip
 * crosses the start tick and fires it twice.
 */
const PREROLL_TICKS = 5 * TICKRATE
const DEMO_LOAD_TIMEOUT_MS = 3 * 60_000
const PLAYDEMO_ACK_TIMEOUT_MS = 15_000
const PLAYDEMO_ATTEMPTS = 3
const SEEK_TIMEOUT_MS = 60_000
const FFMPEG_EXIT_POLLS = 120
/**
 * CS2 renders slower the longer one session records (on a 1 GB GPU, ~6× real time fresh, 15–30×
 * after five clips). A restart costs about half a minute, so the game is restarted after a slow
 * clip and, regardless, every few clips.
 */
const SLOW_RENDER_RATIO = 12
const CLIPS_PER_SESSION = 4
/**
 * What the mirv_pov fork prints when its HUD hooks don't match the CS2 build, or what CS2 prints
 * when the loaded AfxHookSource2.dll has no mirv_pov at all. Side features failing (radio, kill
 * reward text) don't change the HUD and are ignored.
 */
const POV_FAILURE =
  /Unknown command.*mirv_pov|\[mirv_pov_hud\].*(?:not found|not available|not loaded)|pov-target-unavailable/i
const POV_CHECK_MS = 1500
/** Offline rendering on a weak GPU runs well below real time; scale the timeout with the clip. */
const RENDER_TIMEOUT_PER_DEMO_SECOND_MS = 30_000
/** HLAE's offline capture rate (`mirv_streams record fps`). */
const FPS = 60
/** How often the frame count is read while a segment captures. */
const PROGRESS_POLL_MS = 1000
/**
 * H.264 that browsers stream directly; `{QUOTE}` and `\\` are HLAE's escapes. `-progress` has
 * ffmpeg append its frame count to a file in the take: how far the capture has got.
 */
const CAPTURE_FFMPEG = [
  '-c:v libx264 -preset faster -crf 20 -pix_fmt yuv420p',
  '-progress {QUOTE}{AFX_STREAM_PATH}\\\\progress.txt{QUOTE}',
  '{QUOTE}{AFX_STREAM_PATH}\\\\video.mp4{QUOTE}',
].join(' ')
/** Demos are copied here, relative to `game/csgo`, as `playdemo` only reads from the game tree. */
const DEMO_NAME = 'subtick/demo'

const segmentFrames = (segment: ClipSegment) =>
  Math.max(1, Math.round(((segment.endTick - segment.startTick) / TICKRATE) * FPS))

/** Frames HLAE's ffmpeg has encoded so far in the segment's latest take, from its `-progress` file. */
const capturedFrames = async (dir: string) => {
  const takes = (await readdir(dir).catch(() => [])).filter((t) => t.startsWith('take')).toSorted()
  if (!takes.length) return null
  const text = await Bun.file(join(dir, takes.at(-1)!, 'progress.txt'))
    .text()
    .catch(() => '')
  const frames = [...text.matchAll(/^frame=(\d+)/gm)].at(-1)?.[1]
  return frames === undefined ? null : Number(frames)
}

export interface Cs2RecorderOptions {
  game: WineGame
  cs2Dir: string
  prefix: string
  /** Where HLAE writes takes; must be inside the prefix so the Windows side can reach it. */
  takesDir: string
  /**
   * Render the player's own HUD instead of CS2's spectator HUD, with `mirv_pov` from the
   * WangChuDi/advancedfx fork's AfxHookSource2.dll (official HLAE has it for CS:GO only; the
   * bootstrap installs the fork when HLAE_POV=1).
   */
  mirvPov?: boolean
  log: Logger<unknown>
}

/**
 * Records clips with CS2 + HLAE: `playdemo`, then for each clip seek, spectate the player and let
 * HLAE capture between two `mirv_cmd` tick triggers. HLAE renders offline at a fixed 60 fps, so a
 * slow GPU makes recording slower, never choppier.
 */
export class Cs2Recorder implements Recorder {
  #netcon: NetCon | null = null
  #matchId: string | null = null
  #takes = 0
  #sessionClips = 0
  /** `mirv_pov` failed in this game session; tried again after a restart. */
  #povBroken = false
  /** `mirv_pov 1` was sent in this game session. */
  #povOn = false
  /** A demo was loaded in this game session. */
  #demoLoaded = false

  constructor(private readonly options: Cs2RecorderOptions) {}

  get loadedMatchId() {
    return this.#netcon?.closed === false ? this.#matchId : null
  }

  async prepare(match: MatchToRecord) {
    const { game, cs2Dir, log } = this.options
    this.#matchId = null
    // A second demo in one game session starts on the wrong player: the first clip showed whoever
    // the camera held after `playdemo` until that player died, though `spec_player` was sent as
    // usual. Each match gets a fresh game instead, the state every first clip is recorded from.
    if (this.#demoLoaded) await this.reset()
    const netcon = (this.#netcon =
      this.#netcon?.closed === false ? this.#netcon : await game.connect())

    await Bun.write(join(cs2Dir, 'game/csgo', `${DEMO_NAME}.dem`), Bun.file(match.demoPath))
    // CS2 drops a `playdemo` that arrives while it is busy changing host state (e.g. still
    // booting); only a queued "Playing Demo" request means it was taken.
    for (let attempt = 1; ; attempt++) {
      const queued = netcon.waitFor(/QueueNewRequest\( Playing Demo/, PLAYDEMO_ACK_TIMEOUT_MS)
      const loaded = netcon.waitFor(/Signon traffic "DEMO"/, DEMO_LOAD_TIMEOUT_MS)
      // Both are awaited below, or abandoned on a retry; never leave a rejection unhandled.
      queued.catch(() => {})
      loaded.catch(() => {})
      // No `disconnect` first: it reloads the menu map, and playdemo disconnects anyway.
      netcon.send('exec subtick', `playdemo ${DEMO_NAME}`)
      try {
        await queued
      } catch (error) {
        if (attempt === PLAYDEMO_ATTEMPTS) throw error
        log.warn({ matchId: match.matchId, attempt }, 'playdemo not taken, retrying')
        await Bun.sleep(10_000)
        continue
      }
      await loaded
      break
    }
    netcon.send(
      'demo_pause',
      'mirv_streams record screen enabled 1',
      `mirv_streams record fps ${FPS}`,
      // Game audio as a WAV next to the video, rendered in step with the frames.
      'mirv_streams record startMovieWav 1',
      // The delivery encode happens here, once: browsers play it as is after a trim.
      `mirv_streams settings add ffmpeg subtick "${CAPTURE_FFMPEG}"`,
      'mirv_streams settings edit afxDefault settings subtick',
    )
    this.#matchId = match.matchId
    this.#demoLoaded = true
    log.info({ matchId: match.matchId, map: match.map }, 'demo loaded')
  }

  async record(clip: ClipPlan): Promise<RecordedFile> {
    const netcon = this.#netcon
    if (!netcon || !this.loadedMatchId) throw new Error('no demo loaded')
    if (/["\n;]/.test(clip.playerName))
      throw new Error(`can't spectate "${clip.playerName}" by name`)
    if (!clip.segments.length) throw new Error(`${clip.highlightId} has no segments`)

    const dir = join(this.options.takesDir, clip.highlightId)
    await rm(dir, { recursive: true, force: true })
    const parts: RecordedPart[] = []
    let renderMs = 0
    const total = clip.segments.reduce((sum, s) => sum + segmentFrames(s), 0)
    let before = 0
    // Segments are in demo order, so each seek is a short skip forward.
    for (const [index, segment] of clip.segments.entries()) {
      const base = before
      const part = await this.#recordSegment(
        netcon,
        join(dir, `segment${index}`),
        clip.playerName,
        segment,
        (frames) => clip.onProgress?.(Math.min((base + frames) / total, 1)),
      )
      before += segmentFrames(segment)
      parts.push(part)
      renderMs += part.renderMs
    }

    const demoSeconds = segmentsTicks(clip.segments) / TICKRATE
    const ratio = renderMs / 1000 / demoSeconds
    if (++this.#sessionClips >= CLIPS_PER_SESSION || ratio > SLOW_RENDER_RATIO) {
      this.options.log.info(
        { clips: this.#sessionClips, ratio: +ratio.toFixed(1) },
        'restarting CS2',
      )
      await this.reset()
    }
    return { parts: parts.map(({ path, audioPath }) => ({ path, audioPath })), dir, renderMs }
  }

  /** Seeks to one segment, spectates the player, and lets HLAE capture it into `dir`. */
  async #recordSegment(
    netcon: NetCon,
    dir: string,
    playerName: string,
    segment: ClipSegment,
    onFrames: (frames: number) => void,
  ): Promise<RecordedPart & { renderMs: number }> {
    const { prefix } = this.options
    await mkdir(dir, { recursive: true })
    const take = ++this.#takes

    netcon.send(
      `mirv_streams record name "${windowsPath(prefix, dir)}"`,
      'mirv_cmd clear',
      `mirv_cmd addAtTick ${segment.startTick} "echo subtick_start_${take}; mirv_streams record start"`,
      `mirv_cmd addAtTick ${segment.endTick} "mirv_streams record end; demo_pause; echo subtick_done_${take}"`,
    )
    const seeked = netcon.waitFor(/Demo Skipping finished/, SEEK_TIMEOUT_MS)
    seeked.catch(() => {})
    netcon.send(`demo_gototick ${Math.max(0, segment.startTick - PREROLL_TICKS)}`)
    await seeked
    // After the seek: a seek resets the spectated player.
    netcon.send(`spec_player "${playerName}"`)
    await this.#enablePov(netcon)

    // CS2 sometimes prints an echo onto the end of another line ("…059 ]subtick_start_7"), so
    // the markers aren't anchored to the line; `(?!\d)` keeps take 1 from matching take 10.
    const marker = (name: string) => new RegExp(`(?:^|\\W)${name}_${take}(?!\\d)`)
    const started = netcon.waitFor(marker('subtick_start'), SEEK_TIMEOUT_MS)
    const demoSeconds = (segment.endTick - segment.startTick) / TICKRATE
    const done = netcon.waitFor(
      marker('subtick_done'),
      SEEK_TIMEOUT_MS + demoSeconds * RENDER_TIMEOUT_PER_DEMO_SECOND_MS,
    )
    done.catch(() => {})
    netcon.send('demo_resume')
    await started
    const renderStart = performance.now()
    const watching = setInterval(() => {
      void capturedFrames(dir).then((frames) => frames !== null && onFrames(frames))
    }, PROGRESS_POLL_MS)
    try {
      await done
    } finally {
      clearInterval(watching)
    }
    onFrames(segmentFrames(segment))
    const renderMs = Math.round(performance.now() - renderStart)

    // HLAE reports the end before its ffmpeg.exe has encoded the tail and closed the file.
    const takeDir = windowsPath(prefix, dir)
    for (let i = 0; i < FFMPEG_EXIT_POLLS && (await findProcesses(takeDir)).length; i++)
      await Bun.sleep(1000)
    if ((await findProcesses(takeDir)).length)
      throw new Error(`HLAE's ffmpeg is still writing ${dir}`)

    // If the trigger fired twice anyway, the last take is the complete one.
    const takes = (await readdir(dir)).filter((t) => t.startsWith('take')).toSorted()
    const path = join(dir, takes.at(-1) ?? 'take0000', 'video.mp4')
    if (!(await Bun.file(path).exists())) throw new Error(`HLAE wrote no video in ${dir}`)
    const wav = (await readdir(dirname(path))).find((f) => f.endsWith('.wav'))
    return { path, audioPath: wav && join(dirname(path), wav), renderMs }
  }

  /**
   * Switches to the spectated player's own HUD, once per game session: after that the hook
   * follows `spec_player` by itself ("POV player changed"). Toggling it again makes CS2 re-sync
   * the demo, a skip that can jump past a segment's start trigger. When the hook can't find what
   * it needs (a CS2 update moved it, or the DLL is official HLAE's), clips keep the spectator HUD.
   */
  async #enablePov(netcon: NetCon) {
    if (!this.options.mirvPov || this.#povOn || this.#povBroken) return
    this.#povOn = true
    const failed = netcon.waitFor(POV_FAILURE, POV_CHECK_MS).then(
      (line) => line,
      () => null,
    )
    netcon.send('mirv_pov 1')
    const line = await failed
    if (!line) return
    this.#povBroken = true
    netcon.send('mirv_pov 0')
    this.options.log.warn(
      { line },
      "mirv_pov can't hook this CS2 build; recording the spectator HUD",
    )
  }

  async reset() {
    this.#povOn = false
    this.#demoLoaded = false
    this.#povBroken = false
    this.#matchId = null
    this.#sessionClips = 0
    this.#netcon?.close()
    this.#netcon = null
    await this.options.game.kill()
  }
}
