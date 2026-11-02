import type { HighlightKind } from '@subtick/domain'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { type Clip, type ClipFilters, clipsQuery, matchQuery } from '@/lib/queries'

/**
 * What the reel beside the player lists: one match's clips (best first), or the highlights feed
 * under the filters the page has. Either way it shares its cache with the page underneath.
 */
export type ReelSource = { match: string } | (ClipFilters & { kinds: HighlightKind[] })

/** A clip that has its recording, as the viewer and its reel show it. */
export type ReelClip = Clip & { clip: NonNullable<Clip['clip']> }

export const recorded = <T extends { clip: Clip['clip'] }>(
  item: T,
): item is T & { clip: NonNullable<Clip['clip']> } => Boolean(item.clip)

export const useReel = (source: ReelSource) => {
  const matchId = 'match' in source ? source.match : undefined
  const feed = useInfiniteQuery({
    ...clipsQuery('kinds' in source ? source : {}),
    enabled: !matchId,
  })
  const match = useQuery({ ...matchQuery(matchId ?? ''), enabled: Boolean(matchId) })

  if (matchId) {
    const data = match.data
    const players = new Map(data?.players.map((p) => [p.steamId, p]))
    const items: ReelClip[] = (data?.highlights ?? []).filter(recorded).map((h) => ({
      ...h,
      map: data!.match.map,
      playedAt: data!.match.playedAt ?? data!.match.createdAt,
      player: {
        name: players.get(h.steamId)?.name ?? 'Unknown',
        avatarUrl: players.get(h.steamId)?.avatarUrl ?? null,
        vanity: players.get(h.steamId)?.vanity ?? null,
      },
    }))

    return {
      items,
      isPending: match.isPending,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    }
  }

  return {
    items: (feed.data?.pages.flatMap((p) => p.items) ?? []).filter(recorded),
    isPending: feed.isPending,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
  }
}
