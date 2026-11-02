import { useIsMutating, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import { focusedNow } from '@/lib/focus-clock'
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

/** `inlineError` when the caller shows the failure itself; otherwise it's toasted. */
type ActionOptions = { inlineError?: boolean }

/** Stops a match's processing; Retry picks it up again. */
export const useCancelMatch = ({ inlineError = false }: ActionOptions = {}) => {
  const refresh = useRefreshMatch()

  return useMutation({
    meta: { inlineError },
    mutationFn: (id: string) => unwrap(api.matches({ id }).cancel.post()),
    onSettled: (_data, _error, id) => refresh(id),
  })
}

/** Runs a failed, expired or cancelled match through the pipeline again. */
export const useRetryMatch = ({ inlineError = false }: ActionOptions = {}) => {
  const refresh = useRefreshMatch()

  return useMutation({
    meta: { inlineError },
    mutationFn: (id: string) => unwrap(api.matches({ id }).retry.post()),
    onSettled: (_data, _error, id) => refresh(id),
  })
}

/**
 * Takes a queued clip off the recording queue. The match cache drops it first, so its card moves
 * from the Queue back to its round at once.
 */
export const useCancelMoment = (matchId: string) => {
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
      markCandidate(id)
    },
    onSettled: () => refresh(matchId),
  })
}

const REFRESH_KEY = ['refresh-matches']

/** `at` is the focus-clock reading when the check finished, so a later view can tell it is stale. */
type RefreshResult = { newMatches: number; done: boolean; at: number }

/**
 * Asks Steam for new matches now, and resolves once the sync has run, with what it found. Every
 * caller shares one refresh: a check started anywhere spins every refresh button, and its result
 * reaches them all.
 */
export const useRefreshMatches = () => {
  const queryClient = useQueryClient()
  const { mutate } = useMutation({
    mutationKey: REFRESH_KEY,
    mutationFn: async () => {
      // A spin short enough to read as instant still says the click landed.
      const [result] = await Promise.all([
        unwrap(api.matches.refresh.post()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ])

      return { ...result, at: focusedNow() }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  })
  const isPending = useIsMutating({ mutationKey: REFRESH_KEY }) > 0
  const data = useMutationState({
    filters: { mutationKey: REFRESH_KEY, status: 'success' },
    select: (m) => m.state.data as RefreshResult,
  }).at(-1)

  return { isPending, data, mutate: () => !isPending && mutate() }
}
