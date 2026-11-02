import type { SteamWebApi } from '@subtick/steam'

/**
 * steamId64 → party id from Steam friendships between a match's players: the GC sends `party_ids` empty and
 * demos don't record parties, but people who queue together are almost always friends. One public friend list
 * is enough; friends of friends share a party, and players with no friend in the match are left out.
 * Friends on opposite teams share an id here too; the parser splits parties by team.
 */
export const friendParties = async (
  steamApi: Pick<SteamWebApi, 'getFriendIds'>,
  steamIds: string[],
): Promise<Record<string, string>> => {
  const players = new Set(steamIds)
  const friends = await Promise.all(steamIds.map((id) => steamApi.getFriendIds(id)))

  const root = new Map(steamIds.map((id) => [id, id]))

  const linked = new Set<string>()

  const find = (id: string): string => {
    const parent = root.get(id)!

    return parent === id ? id : find(parent)
  }

  steamIds.forEach((id, i) => {
    for (const friend of friends[i] ?? []) {
      if (!players.has(friend) || friend === id) continue
      root.set(find(id), find(friend))
      linked.add(id).add(friend)
    }
  })

  return Object.fromEntries([...linked].map((id) => [id, find(id)]))
}
