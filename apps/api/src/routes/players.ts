import { and, desc, eq, inArray, lt, ne, schema, sql } from '@subtick/db'
import { isCancelled } from '@subtick/domain'
import { Elysia } from 'elysia'
import { z } from 'zod'
import type { Context } from '../context'
import { notOneKill } from '../services/highlights'
import { imageUrl, subtickIdentities } from '../services/profile-images'
import {
  type PlayedMatch,
  mapStats,
  ranks,
  resultOf,
  summarize,
  teammates,
} from '../services/player-stats'
import { getProfiles } from '../services/profiles'
import { authGuard } from './guard'

const { match, matchPlayer, highlight, steamLink } = schema

/** How far back the profile looks: the summary uses the newest 30, maps and teammates all of it. */
const HISTORY = 100
const SUMMARY = 30
const PAGE_SIZE = 20

const playedAt = sql<Date>`coalesce(${match.playedAt}, ${match.createdAt})`.mapWith(match.createdAt)
const SteamIdParams = z.object({ steamId: z.string().regex(/^\d{17}$/) })

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
      async ({ user, params: { steamId }, status }) => {
        const [rows, identities, [link]] = await Promise.all([
          history(steamId),
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
        const withCrosshair = rows.find((r) => r.crosshair)

        return {
          steamId,
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
          summary: summarize(matches.slice(0, SUMMARY)),
          /** Oldest first, for the form chart. */
          form: matches
            .slice(0, SUMMARY)
            .map((m) => ({
              matchId: m.matchId,
              map: m.map,
              rating: m.stats.rating,
              result: resultOf(m),
            }))
            .toReversed(),
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
            }
          }),
          crosshair: withCrosshair && {
            code: withCrosshair.crosshair!,
            matchId: withCrosshair.matchId,
            map: withCrosshair.map,
            playedAt: withCrosshair.playedAt,
          },
        }
      },
      { auth: true, params: SteamIdParams },
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
