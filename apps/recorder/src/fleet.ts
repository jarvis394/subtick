import { hostname } from 'node:os'
import { RECORDER_HEARTBEAT_MS, type RecorderState } from '@subtick/domain'
import type { Logger } from '@subtick/logger'
import type { RecorderSettings, SubtickApi } from './api'
import { VERSION } from './self'

/** What this machine reports in every heartbeat. Kept current by the worker as it goes. */
export interface RecorderStatus {
  state: RecorderState
  currentMatchId: string | null
  lastError: string | null
  clipsRecorded: number
  /** Clips failed in a row; subtick shows the machine as failing after a few. */
  failStreak: number
  hlaeVersion: string | null
  hlaePovRelease: string | null
  startedAt: Date
}

export const createStatus = (): RecorderStatus => ({
  state: 'starting',
  currentMatchId: null,
  lastError: null,
  clipsRecorded: 0,
  failStreak: 0,
  hlaeVersion: null,
  hlaePovRelease: null,
  startedAt: new Date(),
})

export const gpuName = async () => {
  try {
    const proc = Bun.spawn(
      ['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader'],
      {
        stdout: 'pipe',
        stderr: 'ignore',
      },
    )
    const out = (await new Response(proc.stdout).text()).trim().split('\n')[0]
    if ((await proc.exited) !== 0 || !out) return null
    const [name, driver] = out.split(', ')

    return driver ? `${name} (driver ${driver})` : (name ?? null)
  } catch {
    return null
  }
}

/**
 * Links a recorder machine to subtick: heartbeats report `status`, and the replies carry the
 * admin's settings (name, paused, HLAE build).
 */
export const createFleetLink = (options: {
  api: SubtickApi
  version: string
  status: RecorderStatus
  log: Logger<unknown>
}) => {
  const { api, version, status, log } = options
  const listeners = new Set<(settings: RecorderSettings) => void>()
  let settings: RecorderSettings | null = null
  let gpu: string | null = null
  let timer: Timer | undefined
  let failing = false

  const heartbeat = async () => {
    try {
      const reply = await api.heartbeat({
        ...status,
        hostname: hostname(),
        gpu,
        version,
        buildVersion: VERSION,
      })
      if (failing) log.info('subtick api reachable again')
      failing = false
      settings = {
        name: reply.name,
        paused: reply.paused,
        killGame: reply.killGame ?? false,
        hlaeTarget: reply.hlaeTarget ?? null,
      }
      for (const listener of listeners) listener(settings)
    } catch (error) {
      if (!failing) log.warn('heartbeat failed; recording goes on with the last settings', error)
      failing = true
    }
  }

  const loop = async () => {
    await heartbeat()
    timer = setTimeout(loop, RECORDER_HEARTBEAT_MS)
  }

  return {
    get settings() {
      return settings
    },
    onSettings(listener: (settings: RecorderSettings) => void) {
      listeners.add(listener)
    },
    async start() {
      gpu = await gpuName()
      await loop()
    },
    stop() {
      clearTimeout(timer)
    },
  }
}

export type FleetLink = ReturnType<typeof createFleetLink>
