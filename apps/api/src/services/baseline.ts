import { and, eq, inArray, lt, lte, ne, schema, sql } from '@subtick/db'
import { BASELINE_MATCHES, type PlayerStats } from '@subtick/domain'
import type { Context } from '../context'

const { match, matchPlayer } = schema

const playedAtOf = sql<Date>`coalesce(${match.playedAt}, ${match.createdAt})`

/** Each player's stats in up to BASELINE_MATCHES matches played before `before`, newest first. */
export const earlierStats = async (
  { db }: Pick<Context, 'db'>,
  steamIds: string[],
  before: { id: string; playedAt: Date | null; createdAt: Date },
) => {
  if (!steamIds.length) return new Map<string, PlayerStats[]>()
  const ranked = db
    .select({
      steamId: matchPlayer.steamId,
      stats: matchPlayer.stats,
      n: sql<number>`row_number() over (partition by ${matchPlayer.steamId} order by ${playedAtOf} desc)`.as(
        'n',
      ),
    })
    .from(matchPlayer)
    .innerJoin(match, eq(match.id, matchPlayer.matchId))
    .where(
      and(
        inArray(matchPlayer.steamId, steamIds),
        ne(match.id, before.id),
        lt(playedAtOf, before.playedAt ?? before.createdAt),
      ),
    )
    .as('ranked')
  const rows = await db.select().from(ranked).where(lte(ranked.n, BASELINE_MATCHES))

  return new Map(
    [...Map.groupBy(rows, (r) => r.steamId)].map(([id, list]) => [id, list.map((r) => r.stats)]),
  )
}
