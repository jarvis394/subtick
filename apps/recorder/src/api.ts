import type { HlaeBuild, RecorderClipUploads, RecorderJob } from '@subtick/domain'

/** What an admin set for this machine in subtick. */
export interface RecorderSettings {
  name: string
  paused: boolean
  /** The HLAE build to install between jobs. */
  hlaeTarget?: HlaeBuild | null
}

/** A failed call, with the HTTP status when subtick answered. */
export class SubtickApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
  }
}

interface ClipInfo {
  durationMs: number
  width: number
  height: number
  recorderVersion: number
}

/** Tries after the first, for a call that found subtick unreachable or failing (1 s, 2 s, 4 s apart). */
const RETRIES = 3

/**
 * Subtick's api as a recorder machine sees it, authenticated with the machine's token. Everything
 * a job reads or writes goes through here; the machine holds no database or bucket credentials.
 * Every call is safe to repeat, so the transient failures of a long batch are retried.
 */
export const createSubtickApi = ({ url, token }: { url: string; token: string }) => {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  const request = async <T>(path: string, body?: unknown, retries = RETRIES): Promise<T> => {
    const response = await fetch(new URL(`/api/recorder${path}`, url), {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null)
    if (response?.ok) return (await response.json()) as T
    if (response?.status === 401)
      throw new SubtickApiError('subtick rejected RECORDER_TOKEN (revoked or mistyped?)', 401)
    const transient = !response || response.status >= 500
    if (!transient || retries <= 0)
      throw new SubtickApiError(
        `subtick api ${path}: ${response ? `HTTP ${response.status}` : 'unreachable'}`,
        response?.status ?? null,
      )
    await Bun.sleep(1000 * 2 ** (RETRIES - retries))

    return request(path, body, retries - 1)
  }

  return {
    /** Checks the token without writing anything. Servers older than this route answer 404. */
    whoami: () => request<Pick<RecorderSettings, 'name' | 'paused'>>('/whoami', undefined, 0),
    /** Not retried: the next heartbeat is the retry. */
    heartbeat: (status: object) => request<RecorderSettings>('/heartbeat', status, 0),
    /** The demo and the clips still to render; `null` when nothing is left to record. */
    startJob: async (job: { matchId: string; highlightIds: string[]; recorderVersion: number }) =>
      (await request<{ job: RecorderJob | null }>('/jobs/start', job)).job,
    finishJob: (matchId: string) => request('/jobs/finish', { matchId }),
    failJob: (job: { matchId: string; highlightIds: string[]; error: string; reason: string }) =>
      request('/jobs/failed', job),
    /** Cancelled while earlier clips recorded, a highlight is no longer queued. */
    isQueued: async (highlightId: string) =>
      (await request<{ queued: boolean }>(`/highlights/${highlightId}/queued`)).queued,
    clipUploads: (highlightId: string) =>
      request<RecorderClipUploads>(`/highlights/${highlightId}/uploads`, {}),
    clipRecorded: (highlightId: string, info: ClipInfo) =>
      request(`/highlights/${highlightId}/recorded`, info),
    clipFailed: (highlightId: string, error: string) =>
      request(`/highlights/${highlightId}/failed`, { error }),
  }
}

export type SubtickApi = ReturnType<typeof createSubtickApi>

/** Fetches an object through its presigned URL. */
export const download = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`)

  return response.bytes()
}

/** Uploads a local file through a presigned PUT URL. */
export const upload = async (url: string, path: string, contentType: string) => {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: Bun.file(path),
  })
  if (!response.ok) throw new Error(`upload failed: HTTP ${response.status}`)
}
