import { hostname } from 'node:os'
import { RECORDER_HEARTBEAT_MS, type RecorderState } from '@subtick/domain'
import type { Logger } from '@subtick/logger'

/** What this machine reports in every heartbeat. Kept current by the worker as it goes. */
export interface RecorderStatus {
  state: RecorderState
  currentMatchId: string | null
  lastError: string | null
  clipsRecorded: number
  startedAt: Date
}

/** What an admin set for this machine in subtick. */
export interface RecorderSettings {
  name: string
  paused: boolean
}

export const createStatus = (): RecorderStatus => ({
  state: 'starting',
  currentMatchId: null,
  lastError: null,
  clipsRecorded: 0,
  startedAt: new Date(),
})

const gpuName = async () => {
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
 * Links a recorder machine to subtick's api with its token: heartbeats report `status`, and the
 * replies carry the admin's settings (name, paused).
 */
export const createFleetLink = (options: {
  url: string
  token: string
  version: string
  status: RecorderStatus
  log: Logger<unknown>
}) => {
  const { url, token, version, status, log } = options
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const listeners = new Set<(settings: RecorderSettings) => void>()
  let settings: RecorderSettings | null = null
  let gpu: string | null = null
  let timer: Timer | undefined
  let failing = false

  const request = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(new URL(`/api/recorder${path}`, url), { ...init, headers })
    if (response.status === 401)
      throw new Error('subtick rejected RECORDER_TOKEN (revoked or mistyped?)')
    if (!response.ok) throw new Error(`subtick api ${path}: HTTP ${response.status}`)

    return (await response.json()) as T
  }

  const heartbeat = async () => {
    try {
      const reply = await request<RecorderSettings>('/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ ...status, hostname: hostname(), gpu, version }),
      })
      if (failing) log.info('subtick api reachable again')
      failing = false
      settings = { name: reply.name, paused: reply.paused }
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
