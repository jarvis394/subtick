import { type PlayerRank, type PlayerStats, type Side, TEAM_SIZE } from '@subtick/domain'

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

export type Result = 'win' | 'loss' | 'draw'

export const resultOf = (
  m: Pick<PlayedMatch, 'startingSide' | 'scoreStartedCt' | 'scoreStartedT'>,
): Result | null => {
  const own = m.startingSide === 'CT' ? m.scoreStartedCt : m.scoreStartedT
  const enemy = m.startingSide === 'CT' ? m.scoreStartedT : m.scoreStartedCt
  if (own === null || enemy === null) return null
  return own > enemy ? 'win' : own < enemy ? 'loss' : 'draw'
}

const round = (n: number, digits = 2) => Number(n.toFixed(digits))
const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

/** Totals across matches, weighted by rounds where a per-match average would skew. */
export const summarize = (matches: PlayedMatch[]) => {
  const sum = (pick: (s: PlayerStats) => number) =>
    matches.reduce((total, m) => total + pick(m.stats), 0)
  const results = matches.map(resultOf)
  const wins = results.filter((r) => r === 'win').length
  const decided = results.filter((r) => r !== null).length
  const kills = sum((s) => s.kills)
  const deaths = sum((s) => s.deaths)
  const rounds = sum((s) => s.roundsPlayed)

  return {
    matches: matches.length,
    wins,
    losses: results.filter((r) => r === 'loss').length,
    winRate: decided ? round((wins / decided) * 100, 0) : null,
    rating: round(average(matches.map((m) => m.stats.rating))),
    kd: round(deaths ? kills / deaths : kills),
    adr: rounds ? round(sum((s) => s.damage) / rounds, 1) : 0,
    hsPercent: kills ? round((sum((s) => s.headshotKills) / kills) * 100, 0) : 0,
    kastPercent: rounds ? round((sum((s) => s.kastRounds) / rounds) * 100, 0) : 0,
    openingWinRate: (() => {
      const duels = sum((s) => s.openingKills + s.openingDeaths)
      return duels ? round((sum((s) => s.openingKills) / duels) * 100, 0) : null
    })(),
    clutchesWon: sum((s) => s.clutchesWon),
    clutchesAttempted: sum((s) => s.clutchesAttempted),
    aces: sum((s) => s.multiKills[4]),
    fourKs: sum((s) => s.multiKills[3]),
  }
}

/** Per map, most played first. */
export const mapStats = (matches: PlayedMatch[]) =>
  [...Map.groupBy(matches, (m) => m.map ?? 'unknown')]
    .map(([map, games]) => {
      const s = summarize(games)
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

/** Premier now and at its best, and the latest skill group per mode. */
export const ranks = (matches: PlayedMatch[]) => {
  const premier = matches.filter((m) => m.rank?.mode === 'premier' && m.rank.after > 0)
  const latest = (mode: 'competitive' | 'wingman') => {
    const m = matches.find((x) => x.rank?.mode === mode && x.rank.after > 0)
    return m ? { group: m.rank!.after, map: m.map } : null
  }
  return {
    premier: premier.length
      ? {
          current: premier[0]!.rank!.after,
          best: Math.max(...premier.map((m) => m.rank!.after)),
        }
      : null,
    competitive: latest('competitive'),
    wingman: latest('wingman'),
  }
}

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
