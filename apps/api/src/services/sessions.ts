import { and, count, desc, eq, gte, inArray, lt, schema, sql } from '@subtick/db'
import {
  type PlayerRank,
  type PlayerStats,
  type Side,
  splitSessions,
  summarize,
} from '@subtick/domain'
import type { Context } from '../context'
import { earlierStats } from './baseline'
import { notOneKill, playedAt } from './highlights'
import { withParties } from './parties'
import { resultOf, scoreOf } from './player-stats'
import { imageUrl, subtickIdentities } from './profile-images'
import { getProfiles } from './profiles'

const { match, matchPlayer, highlight } = schema

/** Matches a page aims for; whole sessions only, so it can come up shorter. */
const PAGE_MATCHES = 30

interface SessionMatch {
  id: string
  status: typeof match.$inferSelect.status
  map: string | null
  playedAt: Date
  discoveredAt: Date
  scoreStartedCt: number | null
  scoreStartedT: number | null
  durationTicks: number | null
  tickrate: number | null
}

interface LineupRow {
  matchId: string
  steamId: string
  name: string
  startingSide: Side
  partyId: string | null
  stats: PlayerStats
  rank: PlayerRank | null
}

const clipKey = (matchId: string, steamId: string) => `${matchId}:${steamId}`

/** Where the rank ended up, with its movement across every match in the same mode. */
const sessionRank = (newestFirst: LineupRow[]) => {
  const ranked = newestFirst.flatMap((r) => (r.rank && r.rank.after > 0 ? [r.rank] : []))
  const latest = ranked[0]
  if (!latest) return null
  const sameMode = ranked.filter((r) => r.mode === latest.mode)

  return {
    ...latest,
    before: sameMode.at(-1)!.before,
    change: sameMode.reduce((total, r) => total + r.change, 0),
  }
}

/** From the first match's start to the last one's end; without its length, to its start. */
const playedMs = (newestFirst: SessionMatch[]) => {
  const last = newestFirst[0]!
  const lastLength =
    last.durationTicks && last.tickrate ? (last.durationTicks / last.tickrate) * 1000 : 0

  return last.playedAt.getTime() + lastLength - newestFirst.at(-1)!.playedAt.getTime()
}

/** The player's usual level going into the session; null without earlier matches. */
const usualLevel = (earlier: PlayerStats[] | undefined) => {
  if (!earlier?.length) return null
  const { rating, kd, adr } = summarize(earlier.map((stats) => ({ stats, result: null })))

  return { rating, kd, adr }
}

/**
 * The matches stay the anchor's. Players are the anchor's party: teammates in a stored Steam party
 * with them, or teammates in another stored match too, the rule `withParties` applies per match.
 */
export const buildSession = (
  anchor: string,
  newestFirst: SessionMatch[],
  lineups: LineupRow[],
  clips: Map<string, number>,
  earlier: Map<string, PlayerStats[]>,
) => {
  const order = new Map(newestFirst.map((m, i) => [m.id, i]))
  const byId = new Map(newestFirst.map((m) => [m.id, m]))
  const anchorParty = new Map(
    lineups.filter((r) => r.steamId === anchor).map((r) => [r.matchId, r.partyId]),
  )
  const rows = lineups
    .filter((r) => r.partyId !== null && anchorParty.get(r.matchId) === r.partyId)
    .toSorted((a, b) => order.get(a.matchId)! - order.get(b.matchId)!)

  const players = [...Map.groupBy(rows, (r) => r.steamId)].map(([steamId, own]) => {
    const played = own.map((r) => {
      const scored = { ...byId.get(r.matchId)!, startingSide: r.startingSide }
      const { kills, deaths, assists, rating, adr, hsPercent } = r.stats

      return {
        matchId: r.matchId,
        startingSide: r.startingSide,
        rank: r.rank,
        stats: { kills, deaths, assists, rating, adr, hsPercent },
        result: resultOf(scored),
        score: scoreOf(scored),
        clips: clips.get(clipKey(r.matchId, steamId)) ?? 0,
      }
    })
    const summary = summarize(own.map((r, i) => ({ stats: r.stats, result: played[i]!.result })))

    return {
      steamId,
      name: own[0]!.name,
      isAnchor: steamId === anchor,
      matches: summary.matches,
      wins: summary.wins,
      losses: summary.losses,
      rating: summary.rating,
      kd: summary.kd,
      adr: summary.adr,
      rank: sessionRank(own),
      usual: usualLevel(earlier.get(steamId)),
      clips: played.reduce((total, p) => total + p.clips, 0),
      played,
    }
  })

  return {
    /** The newest match's: the profile, capped at its own window, always has that one. */
    id: newestFirst[0]!.id,
    startedAt: newestFirst.at(-1)!.playedAt,
    playedMs: playedMs(newestFirst),
    matches: newestFirst.map((m) => ({
      id: m.id,
      status: m.status,
      map: m.map,
      playedAt: m.playedAt,
      discoveredAt: m.discoveredAt,
      scoreStartedCt: m.scoreStartedCt,
      scoreStartedT: m.scoreStartedT,
    })),
    players: players.toSorted(
      (a, b) =>
        Number(b.isAnchor) - Number(a.isAnchor) || b.matches - a.matches || b.rating - a.rating,
    ),
  }
}

/** `until` stretches the page back to a session asked for by date, so it can be scrolled to. */
export const sessionsOf = async (
  ctx: Context,
  steamId: string,
  { cursor, until }: { cursor?: string; until?: string },
) => {
  const { db } = ctx
  const own = and(
    eq(matchPlayer.steamId, steamId),
    cursor ? lt(playedAt, new Date(cursor)) : undefined,
  )
  const [through] = until
    ? await db
        .select({ count: count() })
        .from(matchPlayer)
        .innerJoin(match, eq(match.id, matchPlayer.matchId))
        .where(and(own, gte(playedAt, new Date(until))))
    : []
  const limit = (through?.count ?? 0) + PAGE_MATCHES + 1

  const rows = await db
    .select({
      id: match.id,
      status: match.status,
      map: match.map,
      playedAt,
      discoveredAt: match.createdAt,
      scoreStartedCt: match.scoreStartedCt,
      scoreStartedT: match.scoreStartedT,
      durationTicks: match.durationTicks,
      tickrate: match.tickrate,
    })
    .from(matchPlayer)
    .innerJoin(match, eq(match.id, matchPlayer.matchId))
    .where(own)
    .orderBy(desc(playedAt))
    .limit(limit)

  const more = rows.length === limit
  const split = splitSessions(rows)
  // The last one may run on past the page, unless it's all the page has.
  const sessions = more && split.length > 1 ? split.slice(0, -1) : split
  const ids = sessions.flat().map((m) => m.id)
  if (!ids.length) return { items: [], nextCursor: null }

  const [lineups, clipCounts] = await Promise.all([
    db
      .select({
        matchId: matchPlayer.matchId,
        steamId: matchPlayer.steamId,
        name: matchPlayer.name,
        startingSide: matchPlayer.startingSide,
        partyId: matchPlayer.partyId,
        stats: matchPlayer.stats,
        rank: matchPlayer.rank,
      })
      .from(matchPlayer)
      .where(inArray(matchPlayer.matchId, ids)),
    db
      .select({
        matchId: highlight.matchId,
        steamId: highlight.steamId,
        clips: sql<number>`count(*)::int`,
      })
      .from(highlight)
      .where(and(inArray(highlight.matchId, ids), eq(highlight.status, 'recorded'), notOneKill))
      .groupBy(highlight.matchId, highlight.steamId),
  ])
  const clips = new Map(clipCounts.map((c) => [clipKey(c.matchId, c.steamId), c.clips]))
  const partied = (
    await Promise.all(
      [...Map.groupBy(lineups, (r) => r.matchId)].map(([matchId, lineup]) =>
        withParties(ctx, matchId, lineup),
      ),
    )
  ).flat()
  const lineupsByMatch = Map.groupBy(partied, (r) => r.matchId)

  const built = await Promise.all(
    sessions.map(async (session) => {
      const lineup = session.flatMap((m) => lineupsByMatch.get(m.id) ?? [])
      const party = buildSession(steamId, session, lineup, clips, new Map())
      const first = session.at(-1)!
      const earlier = await earlierStats(
        ctx,
        party.players.map((p) => p.steamId),
        { id: first.id, playedAt: first.playedAt, createdAt: first.playedAt },
      )

      return buildSession(steamId, session, lineup, clips, earlier)
    }),
  )

  const shown = [...new Set(built.flatMap((s) => s.players.map((p) => p.steamId)))]
  const [profiles, identities] = await Promise.all([
    getProfiles(ctx, shown),
    subtickIdentities(ctx, shown),
  ])

  return {
    items: built.map((session) => ({
      ...session,
      players: session.players.map((p) => {
        const identity = identities.get(p.steamId)
        const profile = profiles.get(p.steamId)

        return {
          ...p,
          name: identity?.name ?? profile?.personaName ?? p.name,
          avatarUrl: imageUrl(ctx, identity?.avatarKey ?? null) ?? profile?.avatarUrl ?? null,
          bannerUrl: imageUrl(ctx, identity?.bannerKey ?? null),
          vanity: profile?.vanity ?? null,
        }
      }),
    })),
    nextCursor: more ? sessions.at(-1)!.at(-1)!.playedAt.toISOString() : null,
  }
}
