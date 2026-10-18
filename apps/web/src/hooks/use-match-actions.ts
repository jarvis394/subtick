import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flushSync } from 'react-dom'
import { api, unwrap } from '@/lib/api'
import type { MatchDetail, QueueItem } from '@/lib/queries'

/** Everything that shows a match's pipeline state. */
const useRefreshMatch = () => {
  const queryClient = useQueryClient()
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['match', id] }),
      queryClient.invalidateQueries({ queryKey: ['matches'] }),
      queryClient.invalidateQueries({ queryKey: ['queue'] }),
    ])
}

/** Stops a match's processing; Retry picks it up again. */
export const useCancelMatch = () => {
  const refresh = useRefreshMatch()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.matches({ id }).cancel.post()),
    onSettled: (_data, _error, id) => refresh(id),
  })
}

/** Runs a failed, expired or cancelled match through the pipeline again. */
export const useRetryMatch = () => {
  const refresh = useRefreshMatch()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.matches({ id }).retry.post()),
    onSettled: (_data, _error, id) => refresh(id),
  })
}

/**
 * Takes a queued clip off the recording queue. The match cache drops it first; with `morph` (the
 * Create highlights page) that happens inside a `queue` view transition, so its card visibly moves
 * from the Queue back to its round, the way recording moved it there.
 */
export const useCancelMoment = (matchId: string, { morph = false } = {}) => {
  const queryClient = useQueryClient()
  const refresh = useRefreshMatch()
  const key = ['match', matchId]
  const markCandidate = (id: string) =>
    queryClient.setQueryData<MatchDetail>(
      key,
      (data) =>
        data && {
          ...data,
          highlights: data.highlights.map((h) => (h.id === id ? { ...h, status: 'candidate' } : h)),
        },
    )

  return useMutation({
    mutationFn: (id: string) => unwrap(api.highlights({ id }).cancel.post()),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      // The Queue page drops it at once too (it collapses out there).
      queryClient.setQueryData<{ items: QueueItem[] }>(
        ['queue'],
        (data) =>
          data && {
            items: data.items.map((item) => ({
              ...item,
              moments: item.moments.filter((m) => m.id !== id),
            })),
          },
      )
      if (
        morph &&
        document.startViewTransition &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        document.startViewTransition({
          update: () => flushSync(() => markCandidate(id)),
          types: ['queue'],
        })
      else markCandidate(id)
    },
    onSettled: () => refresh(matchId),
  })
}

/** Asks Steam for new matches now instead of at the next scheduled sync. */
export const useRefreshMatches = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      // A spin short enough to read as instant still says the click landed.
      const [result] = await Promise.all([
        unwrap(api.matches.refresh.post()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ])
      return result
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  })
}
