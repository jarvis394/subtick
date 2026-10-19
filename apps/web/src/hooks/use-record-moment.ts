import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import type { MatchDetail } from '@/lib/queries'

/**
 * Queues a moment for recording. The match cache is updated first, so the moment's card moves into
 * the Queue at once; the request follows, and a failure puts the cache back as the server has it.
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
      markQueued(id)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
