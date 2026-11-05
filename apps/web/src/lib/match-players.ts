import type { PlayerSearch } from '@/lib/highlights'
import { partyMarkers } from '@/lib/party'
import type { MatchDetail } from '@/lib/queries'

/**
 * The player picker on a match's pages: each player with how many of `counted` are theirs (the
 * viewer's party first, then the most), and which players the picked `search` keeps. On a match,
 * "people I played with" is the viewer's party, offered only if they queued with others.
 */
export const matchPlayerScope = (
  data: MatchDetail,
  counted: { steamId: string }[],
  search: PlayerSearch,
) => {
  const viewer = data.viewerSteamId
  const me = data.players.find((p) => p.steamId === viewer)
  const party = new Set(
    me && partyMarkers(data.players).has(me.steamId)
      ? data.players
          .filter((p) => p.partyId === me.partyId && p.steamId !== viewer)
          .map((p) => p.steamId)
      : [],
  )
  const counts = new Map<string, number>()
  for (const m of counted) counts.set(m.steamId, (counts.get(m.steamId) ?? 0) + 1)
  const players = data.players
    .map((p) => ({
      ...p,
      clips: counts.get(p.steamId) ?? 0,
      rank: party.has(p.steamId) ? 0 : 1,
    }))
    .toSorted((a, b) => a.rank - b.rank || b.clips - a.clips)
  const picked = new Set(search.players)
  const any = Boolean(search.me || search.playedWith || picked.size)

  return {
    players,
    mySteamIds: viewer ? [viewer] : [],
    hasParty: party.size > 0,
    /** Just one player picked, so lists can leave out whose each moment is. */
    single: !search.playedWith && Number(Boolean(search.me)) + picked.size === 1,
    includes: (steamId: string) =>
      !any ||
      (search.me && steamId === viewer) ||
      (search.playedWith && party.has(steamId)) ||
      picked.has(steamId),
  }
}
