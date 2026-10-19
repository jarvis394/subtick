import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import { queueRecording } from '@/lib/optimistic-queue'
import type { MatchDetail } from '@/lib/queries'

/**
 * Queues a moment for recording. The match and queue caches are updated first, so the moment's
 * card moves into the Queue (and the queue button counts it) at once; the request follows, and a
 * failure puts the caches back as the server has them.
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
      await Promise.all([
        queryClient.cancelQueries({ queryKey: key }),
        queryClient.cancelQueries({ queryKey: ['queue'] }),
      ])
      queueRecording(queryClient, matchId, id)
      markQueued(id)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['queue'] }),
      ]),
  })
}
