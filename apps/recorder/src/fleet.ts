import { hostname } from 'node:os'
import {
  RECORDER_HEARTBEAT_FAST_MS,
  RECORDER_HEARTBEAT_MS,
  type RecorderState,
  type SteamMode,
} from '@subtick/domain'
import type { Logger } from '@subtick/logger'
import type { SteamCredentials } from './cs2/steam-login'
import type { SteamAccountSource } from './cs2/wine'

/** What this machine reports in every heartbeat. Kept current by the worker as it goes. */
export interface RecorderStatus {
  state: RecorderState
  steamMode: SteamMode
  signedInAs: string | null
  currentMatchId: string | null
  lastError: string | null
  clipsRecorded: number
  startedAt: Date
}

/** What an admin set for this machine in subtick. */
export interface RecorderSettings {
  name: string
  paused: boolean
  steamAccount: { username: string; updatedAt: string } | null
}

export const createStatus = (steamMode: SteamMode): RecorderStatus => ({
  state: 'starting',
  steamMode,
  signedInAs: null,
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
 * replies carry the admin's settings (paused, which Steam account) and emailed Steam Guard codes.
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
  let guardCode: string | null = null
  let gpu: string | null = null
  let timer: Timer | undefined
  let failing = false
  /** What the machine was doing before Steam needed a sign-in, to go back to afterwards. */
  let beforeSignIn: RecorderState | null = null
  /** Why a sign-in step is being repeated, while it is. */
  let signInNote: string | null = null

  const request = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(new URL(`/api/recorder${path}`, url), { ...init, headers })
    if (response.status === 401)
      throw new Error('subtick rejected RECORDER_TOKEN (revoked or mistyped?)')
    if (!response.ok) throw new Error(`subtick api ${path}: HTTP ${response.status}`)
    return (await response.json()) as T
  }

  const heartbeat = async () => {
    try {
      const reply = await request<RecorderSettings & { guardCode: string | null }>('/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ ...status, hostname: hostname(), gpu, version }),
      })
      if (failing) log.info('subtick api reachable again')
      failing = false
      if (reply.guardCode) guardCode = reply.guardCode
      settings = { name: reply.name, paused: reply.paused, steamAccount: reply.steamAccount }
      for (const listener of listeners) listener(settings)
    } catch (error) {
      if (!failing) log.warn('heartbeat failed; recording goes on with the last settings', error)
      failing = true
    }
  }

  const loop = async () => {
    await heartbeat()
    const fast = status.state === 'needs_guard_code' || status.state === 'signing_in'
    timer = setTimeout(loop, fast ? RECORDER_HEARTBEAT_FAST_MS : RECORDER_HEARTBEAT_MS)
  }

  const steamAccount: SteamAccountSource = {
    async credentials() {
      const creds = await request<SteamCredentials & { sharedSecret: string | null }>(
        '/steam-credentials',
      ).catch((error: unknown) => {
        log.warn('could not fetch Steam credentials', error)
        return null
      })
      return creds ? { ...creds, sharedSecret: creds.sharedSecret ?? undefined } : undefined
    },
    async takeGuardCode() {
      const code = guardCode
      guardCode = null
      return code
    },
    onSigningIn(phase, note) {
      // The note rides in `lastError`, which the admin sees next to the code form.
      if (status.lastError === signInNote) status.lastError = null
      signInNote = null
      if (phase === 'done') {
        if (beforeSignIn) status.state = beforeSignIn
        beforeSignIn = null
        return
      }
      beforeSignIn ??= status.state
      if (note) status.lastError = signInNote = note
      status.state = phase === 'needs_guard_code' ? 'needs_guard_code' : 'signing_in'
      // Tell the admin right away rather than on the next tick.
      void heartbeat()
    },
  }

  return {
    steamAccount,
    get settings() {
      return settings
    },
    /** Sends the current status now, e.g. after a state change an admin is waiting on. */
    report: heartbeat,
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
