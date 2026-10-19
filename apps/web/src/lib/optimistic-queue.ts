import type { QueryClient } from '@tanstack/react-query'
import type { MatchDetail, Me, QueueItem } from '@/lib/queries'

type Queue = { items: QueueItem[] }
type QueueClip = QueueItem['moments'][number]

/**
 * Puts a moment the viewer just asked to record into the cached queue, as the server will list it
 * once the job is in: under its match if that is already recording, or as a new match waiting in
 * line. The queue's next fetch replaces it with the real job.
 */
export const queueRecording = (queryClient: QueryClient, matchId: string, momentId: string) => {
  const match = queryClient.getQueryData<MatchDetail>(['match', matchId])
  const h = match?.highlights.find((m) => m.id === momentId)
  const me = queryClient.getQueryData<Me>(['me'])
  if (!match || !h || !me) return
  const player = match.players.find((p) => p.steamId === h.steamId)

  const clip: QueueClip = {
    id: h.id,
    title: h.title,
    kind: h.kind,
    round: h.round,
    startTick: h.startTick,
    endTick: h.endTick,
    segments: h.segments,
    kills: h.kills.map((k) => ({ tags: k.tags })),
    clutch: h.clutch,
    state: 'waiting',
    error: null,
    phase: null,
    progress: null,
    steamId: h.steamId,
    player: { name: player?.name ?? 'Unknown', avatarUrl: player?.avatarUrl ?? null },
    requester: { id: me.user.id, name: me.user.name, image: me.user.image, isViewer: true },
    canCancel: true,
  }

  queryClient.setQueryData<Queue>(['queue'], (queue) => {
    if (!queue) return queue
    const existing = queue.items.find((item) => item.matchId === matchId)
    // Still being found, downloaded or analyzed: its clips come after, and the row counts as one.
    if (existing && existing.stage !== 'recording') return queue
    if (existing)
      return {
        items: queue.items.map((item) =>
          item === existing
            ? {
                ...item,
                clips: item.clips + (item.moments.some((m) => m.id === h.id) ? 0 : 1),
                moments: [...item.moments.filter((m) => m.id !== h.id), clip].toSorted(
                  (a, b) => a.startTick - b.startTick,
                ),
              }
            : item,
        ),
      }
    const now = new Date()
    const item: QueueItem = {
      matchId,
      map: match.match.map,
      playedAt: match.match.playedAt ?? match.match.createdAt,
      status: match.match.status,
      stage: 'recording',
      state: 'waiting',
      progress: null,
      clips: 1,
      moments: [clip],
      queuedAt: now,
      startedAt: null,
      mine: match.viewerSteamId !== null,
      canCancel: true,
    }
    return { items: [...queue.items, item] }
  })
}
