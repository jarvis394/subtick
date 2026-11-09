import {
  type MatchResult,
  type PlayerRank,
  type PlayerStats,
  type Side,
  TEAM_SIZE,
  summarize,
} from '@subtick/domain'

/** One of the player's analyzed matches, newest first in every list below. */
export interface PlayedMatch {
  matchId: string
  map: string | null
  playedAt: Date
  startingSide: Side
  stats: PlayerStats
  rank: PlayerRank | null
  partyId: string | null
  crosshair: string | null
  scoreStartedCt: number | null
  scoreStartedT: number | null
}

export interface MatchPlayerRow {
  matchId: string
  steamId: string
  name: string
  startingSide: Side
  stats: PlayerStats
  partyId: string | null
}

type Scored = Pick<PlayedMatch, 'startingSide' | 'scoreStartedCt' | 'scoreStartedT'>

/** From the player's side: their team first. */
export const scoreOf = (m: Scored) => {
  const own = m.startingSide === 'CT' ? m.scoreStartedCt : m.scoreStartedT
  const enemy = m.startingSide === 'CT' ? m.scoreStartedT : m.scoreStartedCt

  return own === null || enemy === null ? null : { own, enemy }
}

export const resultOf = (m: Scored): MatchResult | null => {
  const score = scoreOf(m)
  if (!score) return null

  return score.own > score.enemy ? 'win' : score.own < score.enemy ? 'loss' : 'draw'
}

const round = (n: number, digits = 2) => Number(n.toFixed(digits))

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

export const withResult = (m: PlayedMatch) => ({ stats: m.stats, result: resultOf(m) })

/** Per map, most played first. */
export const mapStats = (matches: PlayedMatch[]) =>
  [...Map.groupBy(matches, (m) => m.map ?? 'unknown')]
    .map(([map, games]) => {
      const s = summarize(games.map(withResult))

      return {
        map,
        matches: s.matches,
        wins: s.wins,
        winRate: s.winRate,
        rating: s.rating,
        kd: s.kd,
        adr: s.adr,
        lastPlayedAt: games[0]!.playedAt,
      }
    })
    .toSorted((a, b) => b.matches - a.matches || (b.winRate ?? 0) - (a.winRate ?? 0))

/** Premier now and at its best; per skill-group mode, the highest with its map. */
export const ranks = (matches: PlayedMatch[]) => {
  const premier = matches.filter((m) => m.rank?.mode === 'premier' && m.rank.after > 0)

  const groups = (mode: 'competitive' | 'wingman') => {
    const ranked = matches.filter((x) => x.rank?.mode === mode && x.rank.after > 0)
    if (!ranked.length) return null
    const top = ranked.reduce((a, b) => (b.rank!.after > a.rank!.after ? b : a))

    return { best: top.rank!.after, bestMap: top.map }
  }

  return {
    premier: premier.length
      ? {
          current: premier[0]!.rank!.after,
          best: Math.max(...premier.map((m) => m.rank!.after)),
        }
      : null,
    competitive: groups('competitive'),
    wingman: groups('wingman'),
  }
}

const CROSSHAIR_HISTORY = 10

/** The player's distinct crosshairs, latest first. */
export const crosshairHistory = (matches: PlayedMatch[]) =>
  [...new Set(matches.flatMap((m) => (m.crosshair ? [m.crosshair] : [])))].slice(
    0,
    CROSSHAIR_HISTORY,
  )

/**
 * Who the player plays with. A teammate seen in two or more of these matches is a regular:
 * matchmaking rarely pairs the same strangers twice, the same rule as match parties. A party is
 * the player plus the regulars and stored party members on their team that match.
 */
export const teammates = (matches: PlayedMatch[], others: MatchPlayerRow[]) => {
  const own = new Map(matches.map((m) => [m.matchId, m]))
  const together = others.filter((o) => own.get(o.matchId)?.startingSide === o.startingSide)

  const byPlayer = Map.groupBy(together, (o) => o.steamId)
  const list = [...byPlayer].map(([steamId, rows]) => {
    const shared = rows.map((r) => own.get(r.matchId)!)
    const results = shared.map(resultOf).filter((r) => r !== null)

    return {
      steamId,
      name: rows[0]!.name,
      matches: rows.length,
      winRate: results.length
        ? round((results.filter((r) => r === 'win').length / results.length) * 100, 0)
        : null,
      ownRating: round(average(shared.map((m) => m.stats.rating))),
      theirRating: round(average(rows.map((r) => r.stats.rating))),
      lastPlayedAt: shared[0]!.playedAt,
    }
  })
  const regulars = new Set(list.filter((t) => t.matches >= 2).map((t) => t.steamId))

  // partySizes[n - 1] = matches queued as an n-stack.
  const partySizes = Array<number>(TEAM_SIZE).fill(0)
  const byMatch = Map.groupBy(together, (o) => o.matchId)
  for (const m of matches) {
    const mates = byMatch.get(m.matchId) ?? []
    const party = mates.filter(
      (o) => regulars.has(o.steamId) || (m.partyId !== null && o.partyId === m.partyId),
    )
    partySizes[Math.min(party.length, TEAM_SIZE - 1)]! += 1
  }
  const usual = partySizes.indexOf(Math.max(...partySizes)) + 1

  return {
    teammates: list
      .filter((t) => regulars.has(t.steamId))
      .toSorted(
        (a, b) => b.matches - a.matches || b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime(),
      ),
    party: { sizes: partySizes, usual: matches.length ? usual : null },
  }
}
