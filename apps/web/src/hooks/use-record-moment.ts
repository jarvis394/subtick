import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flushSync } from 'react-dom'
import { api, unwrap } from '@/lib/api'
import type { MatchDetail } from '@/lib/queries'

/**
 * Queues a moment for recording. The match cache is updated first, inside a view transition
 * (type `queue`), so the moment's card visibly moves into the Queue group; the request follows,
 * and a failure puts the cache back as the server has it.
 */
export const useRecordMoment = (matchId: string) => {
  const queryClient = useQueryClient()
  const key = ['match', matchId]

  const markQueued = (id: string) =>
    queryClient.setQueryData<MatchDetail>(
      key,
      (data) =>
        data && {
          ...data,
          highlights: data.highlights.map((h) => (h.id === id ? { ...h, status: 'queued' } : h)),
        },
    )

  return useMutation({
    mutationFn: (id: string) => unwrap(api.highlights({ id }).record.post()),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        document.startViewTransition({
          update: () => flushSync(() => markQueued(id)),
          types: ['queue'],
        })
      else markQueued(id)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
