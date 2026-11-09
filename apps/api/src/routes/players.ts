import { and, desc, eq, inArray, lt, ne, schema, sql } from '@subtick/db'
import { isCancelled, lobbyTotals } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { notOneKill } from '../services/highlights'
import { imageUrl, subtickIdentities } from '../services/profile-images'
import {
  type PlayedMatch,
  crosshairHistory,
  mapStats,
  ranks,
  resultOf,
  scoreOf,
  teammates,
} from '../services/player-stats'
import { getProfiles, resolvePlayer } from '../services/profiles'
import { authGuard } from './guard'

const { match, matchPlayer, highlight, steamLink } = schema

/** How far back the profile looks, for its stats, maps and teammates. */
const HISTORY = 100
const PAGE_SIZE = 20

const playedAt = sql<Date>`coalesce(${match.playedAt}, ${match.createdAt})`.mapWith(match.createdAt)
const SteamIdParams = z.object({ steamId: z.string().regex(/^\d{17}$/) })
/** A Steam ID or a Steam vanity name (2–32 letters, digits, _ and -). */
const PlayerParams = z.object({ steamId: z.string().regex(/^(\d{17}|[\w-]{2,32})$/) })

/** Any player seen in a match has a profile, subtick user or not; profiles are shared like clips. */
export const playerRoutes = (ctx: Context) => {
  const { db, auth } = ctx

  const history = (steamId: string) =>
    db
      .select({
        matchId: match.id,
        map: match.map,
        playedAt,
        startingSide: matchPlayer.startingSide,
        stats: matchPlayer.stats,
        rank: matchPlayer.rank,
        partyId: matchPlayer.partyId,
        crosshair: matchPlayer.crosshair,
        scoreStartedCt: match.scoreStartedCt,
        scoreStartedT: match.scoreStartedT,
        name: matchPlayer.name,
      })
      .from(matchPlayer)
      .innerJoin(match, eq(match.id, matchPlayer.matchId))
      .where(eq(matchPlayer.steamId, steamId))
      .orderBy(desc(playedAt))
      .limit(HISTORY)

  return new Elysia({ prefix: '/players' })
    .use(authGuard(auth))
    .get(
      '/:steamId',
      async ({ user, params, status }) => {
        const steamId = await resolvePlayer(ctx, params.steamId)
        if (!steamId) return status(404, { error: 'not_found' as const })

        const [rows, [played], identities, [link]] = await Promise.all([
          history(steamId),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(matchPlayer)
            .where(eq(matchPlayer.steamId, steamId)),
          subtickIdentities(ctx, [steamId]),
          db
            .select({ personaName: steamLink.personaName, avatarUrl: steamLink.avatarUrl })
            .from(steamLink)
            .where(eq(steamLink.steamId, steamId)),
        ])
        const identity = identities.get(steamId)
        if (!rows.length && !identity) return status(404, { error: 'not_found' as const })

        const matches: PlayedMatch[] = rows
        const others = rows.length
          ? await db
              .select({
                matchId: matchPlayer.matchId,
                steamId: matchPlayer.steamId,
                name: matchPlayer.name,
                startingSide: matchPlayer.startingSide,
                stats: matchPlayer.stats,
                partyId: matchPlayer.partyId,
              })
              .from(matchPlayer)
              .where(
                and(
                  inArray(
                    matchPlayer.matchId,
                    rows.map((r) => r.matchId),
                  ),
                  ne(matchPlayer.steamId, steamId),
                ),
              )
          : []
        const team = teammates(matches, others)
        const lobbies = Map.groupBy(others, (o) => o.matchId)
        const shown = team.teammates.slice(0, 20)

        const ids = [steamId, ...shown.map((t) => t.steamId)]
        const [profiles, mates, [clips]] = await Promise.all([
          getProfiles(ctx, ids),
          subtickIdentities(ctx, ids),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(highlight)
            .where(
              and(eq(highlight.steamId, steamId), eq(highlight.status, 'recorded'), notOneKill),
            ),
        ])
        const steam = profiles.get(steamId)

        return {
          steamId,
          /** Profile URLs use it in place of the Steam ID. */
          vanity: steam?.vanity ?? null,
          isMe: identity?.userId === user.id,
          /** The subtick display name; otherwise Steam's, or the last in-game name. */
          name: identity?.name ?? steam?.personaName ?? rows[0]?.name ?? steamId,
          personaName: link?.personaName ?? steam?.personaName ?? rows[0]?.name ?? null,
          avatarUrl:
            imageUrl(ctx, identity?.avatarKey ?? null) ??
            link?.avatarUrl ??
            steam?.avatarUrl ??
            null,
          bannerUrl: imageUrl(ctx, identity?.bannerKey ?? null),
          memberSince: identity?.memberSince ?? null,
          lastMatchAt: rows[0]?.playedAt ?? null,
          clipCount: clips?.count ?? 0,
          /** Every match on record, past the window `history` is capped to. */
          matchCount: played?.count ?? 0,
          /** Newest first; the profile summarizes any window of it against the same lobbies. */
          history: matches.map((m) => ({
            matchId: m.matchId,
            map: m.map,
            playedAt: m.playedAt,
            result: resultOf(m),
            score: scoreOf(m),
            rank: m.rank,
            stats: m.stats,
            lobby: lobbyTotals((lobbies.get(m.matchId) ?? []).map((o) => o.stats)),
          })),
          ranks: ranks(matches),
          maps: mapStats(matches),
          party: team.party,
          teammates: shown.map((t) => {
            const mate = mates.get(t.steamId)
            const profile = profiles.get(t.steamId)

            return {
              ...t,
              name: mate?.name ?? profile?.personaName ?? t.name,
              avatarUrl: imageUrl(ctx, mate?.avatarKey ?? null) ?? profile?.avatarUrl ?? null,
              vanity: profile?.vanity ?? null,
            }
          }),
          crosshairs: crosshairHistory(matches),
        }
      },
      { auth: true, params: PlayerParams },
    )
    .get(
      '/:steamId/matches',
      async ({ params: { steamId }, query }) => {
        const rows = await db
          .select({
            id: match.id,
            status: match.status,
            error: match.error,
            map: match.map,
            mode: match.mode,
            playedAt: match.playedAt,
            discoveredAt: match.createdAt,
            scoreStartedCt: match.scoreStartedCt,
            scoreStartedT: match.scoreStartedT,
            player: {
              startingSide: matchPlayer.startingSide,
              stats: matchPlayer.stats,
              rank: matchPlayer.rank,
            },
            highlightCount: sql<number>`(
              select count(*)::int from ${highlight}
              where ${highlight.matchId} = ${match.id} and ${highlight.steamId} = ${steamId}
                and ${notOneKill}
            )`,
            sortAt: playedAt,
          })
          .from(matchPlayer)
          .innerJoin(match, eq(match.id, matchPlayer.matchId))
          .where(
            and(
              eq(matchPlayer.steamId, steamId),
              query.cursor ? lt(playedAt, new Date(query.cursor)) : undefined,
            ),
          )
          .orderBy(desc(playedAt))
          .limit(PAGE_SIZE)

        return {
          items: rows.map(({ error, ...row }) => ({
            ...row,
            cancelled: isCancelled({ status: row.status, error }),
          })),
          nextCursor: rows.length === PAGE_SIZE ? rows.at(-1)!.sortAt.toISOString() : null,
        }
      },
      {
        auth: true,
        params: SteamIdParams,
        query: z.object({ cursor: z.iso.datetime().optional() }),
      },
    )
}
