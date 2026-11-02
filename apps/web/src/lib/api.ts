import { treaty } from '@elysiajs/eden'
import type { App } from '@subtick/api'

/** Typed client generated from the api's routes. Same origin: Vite proxies /api in dev. */
export const { api } = treaty<App>(window.location.origin, { fetch: { credentials: 'include' } })

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly value: unknown,
  ) {
    super(
      typeof value === 'object' && value && 'error' in value
        ? String(value.error)
        : `HTTP ${status}`,
    )
  }
}

/** Eden returns `{ data, error }`; queries want the data or a thrown error. */
export const unwrap = async <
  R extends { data: unknown; error: { status: unknown; value: unknown } | null },
>(
  request: Promise<R>,
): Promise<NonNullable<R['data']>> => {
  const { data, error } = await request
  if (error) throw new ApiError(Number(error.status), error.value)

  return data as NonNullable<R['data']>
}
