import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

/** Live pipeline progress: refetch whatever shows a match when its status changes. */
export const useMatchEvents = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true })
    source.addEventListener('match', (message) => {
      const { matchId } = JSON.parse((message as MessageEvent<string>).data) as { matchId: string }
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
      void queryClient.invalidateQueries({ queryKey: ['match', matchId] })
      void queryClient.invalidateQueries({ queryKey: ['highlights'] })
    })
    return () => source.close()
  }, [queryClient])
}
