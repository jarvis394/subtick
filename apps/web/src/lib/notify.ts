import { toast } from 'sonner'
import { ApiError } from './api'

/** What a toast says about a failure nobody on the page was waiting to show. */
const describe = (error: unknown) => {
  if (error instanceof ApiError)
    return error.status >= 500
      ? 'The server ran into a problem. Try again in a moment.'
      : error.message
  // fetch rejects with a TypeError when the request never got an answer.
  if (error instanceof TypeError) return 'Couldn’t reach the server. Check your connection.'

  return error instanceof Error ? error.message : undefined
}

/**
 * Toasts an error that has no place of its own on the page. `id` folds repeats of the same failure
 * (a polling query) into one toast instead of stacking them.
 */
export const notifyError = (title: string, error?: unknown, id?: string) =>
  toast.error(title, { id, description: error === undefined ? undefined : describe(error) })
