import { aliasedTable, and, eq, gt, inArray, ne, schema } from '@subtick/db'
import type { Context } from '../context'

const { matchPlayer } = schema

interface Player {
  steamId: string
  startingSide: string
  partyId: string | null
}

/**
 * Party ids for a match's players. Stored ones come from Steam friendships (see the steam
 * worker), which miss friends whose friend lists are both private. So teammates who were also
 * teammates in another stored match join a party too: matchmaking rarely pairs the same
 * strangers twice. Teammates linked either way, directly or through each other, share a party.
 */
export const withParties = async <P extends Player>(
  { db }: Pick<Context, 'db'>,
  matchId: string,
  players: P[],
): Promise<P[]> => {
  const ids = players.map((p) => p.steamId)
  const a = matchPlayer
  const b = aliasedTable(matchPlayer, 'b')
  const pairs = await db
    .selectDistinct({ a: a.steamId, b: b.steamId })
    .from(a)
    .innerJoin(
      b,
      and(eq(b.matchId, a.matchId), eq(b.startingSide, a.startingSide), gt(b.steamId, a.steamId)),
    )
    .where(and(ne(a.matchId, matchId), inArray(a.steamId, ids), inArray(b.steamId, ids)))

  const side = new Map(players.map((p) => [p.steamId, p.startingSide]))
  const root = new Map(ids.map((id) => [id, id]))
  const find = (id: string): string => {
    const parent = root.get(id)!
    return parent === id ? id : find(parent)
  }
  const link = (x: string, y: string) => {
    if (side.get(x) === side.get(y)) root.set(find(x), find(y))
  }

  const firstInParty = new Map<string, string>()
  for (const p of players) {
    if (!p.partyId) continue
    const first = firstInParty.get(p.partyId)
    if (first) link(first, p.steamId)
    else firstInParty.set(p.partyId, p.steamId)
  }
  for (const pair of pairs) link(pair.a, pair.b)

  return players.map((p) => ({ ...p, partyId: find(p.steamId) }))
}
