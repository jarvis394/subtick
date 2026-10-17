import type { SteamWebApi } from '@subtick/steam'

/**
 * steamId64 → party id, from Steam friendships between a match's players. CS2's Game Coordinator
 * sends `party_ids` empty and demos don't record parties, but people who queue together are
 * almost always Steam friends, which is what Leetify's party icons match too. A friendship only
 * needs one of the two friend lists to be public, and friends of friends end up in one party.
 * Players with no friend in the match are left out, like solo queuers in the GC's `party_ids`.
 * Friends on opposite teams also share an id here; the parser splits parties by team.
 */
export const friendParties = async (
  steamApi: Pick<SteamWebApi, 'getFriendIds'>,
  steamIds: string[],
): Promise<Record<string, string>> => {
  const players = new Set(steamIds)
  const friends = await Promise.all(steamIds.map((id) => steamApi.getFriendIds(id)))

  const root = new Map(steamIds.map((id) => [id, id]))
  const find = (id: string): string => {
    const parent = root.get(id)!
    return parent === id ? id : find(parent)
  }
  const linked = new Set<string>()
  steamIds.forEach((id, i) => {
    for (const friend of friends[i] ?? []) {
      if (!players.has(friend) || friend === id) continue
      root.set(find(id), find(friend))
      linked.add(id).add(friend)
    }
  })

  return Object.fromEntries([...linked].map((id) => [id, find(id)]))
}
