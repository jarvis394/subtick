import type { MatchStatus } from '@subtick/domain'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface MatchEvent {
  matchId: string
  status: MatchStatus
  progress?: number
}

/** The latest progress each match streamed, by match id. Lives only in the query cache. */
type ProgressMap = Record<string, { status: MatchStatus; progress: number }>
const PROGRESS_KEY = ['match-progress']

/** Live pipeline progress: refetch whatever shows a match when its status changes. */
export const useMatchEvents = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true })
    source.addEventListener('match', (message) => {
      const { matchId, status, progress } = JSON.parse(
        (message as MessageEvent<string>).data,
      ) as MatchEvent
      queryClient.setQueryData<ProgressMap>(PROGRESS_KEY, (map = {}) => {
        const { [matchId]: _, ...rest } = map
        return progress === undefined ? rest : { ...rest, [matchId]: { status, progress } }
      })
      // Downloads report every second; only the percentage changes, nothing to refetch.
      if (status === 'downloading' && progress !== undefined) return
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
      void queryClient.invalidateQueries({ queryKey: ['match', matchId] })
      void queryClient.invalidateQueries({ queryKey: ['highlights'] })
      void queryClient.invalidateQueries({ queryKey: ['queue'] })
    })
    return () => source.close()
  }, [queryClient])
}

/** Every match's latest streamed progress. */
export const useProgressMap = () =>
  useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => ({}) as ProgressMap,
    initialData: {} as ProgressMap,
    staleTime: Infinity,
  }).data

/** A match's streamed progress (0..1) while it is in `status`, if its stage reported any. */
export const useMatchProgress = (matchId: string, status: MatchStatus) => {
  const entry = useProgressMap()[matchId]
  return entry?.status === status ? entry.progress : undefined
}

/** 0.42 → "42%". */
export const percent = (progress: number) => `${Math.floor(progress * 100)}%`
