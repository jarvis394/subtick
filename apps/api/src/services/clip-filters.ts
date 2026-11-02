import {
  type Db,
  and,
  arrayContains,
  count,
  desc,
  eq,
  exists,
  inArray,
  ne,
  or,
  schema,
  sql,
} from '@subtick/db'
import { HIGHLIGHT_KINDS, KILL_TAGS, MOMENT_TAGS } from '@subtick/domain'
import { z } from 'zod'
import type { Context } from '../context'
import { notOneKill, playedAt } from './highlights'
import { getProfiles } from './profiles'

const { highlight, match, matchPlayer, userMatch } = schema

const flag = z.union([z.boolean(), z.enum(['true', 'false'])]).optional()

/** Comma-separated, or repeated. */
const list = z.union([z.string(), z.array(z.string())]).optional()

/** The highlights feed's filters as query params. Lists combine as the feed's UI says. */
export const clipFilterQuery = z.object({
  kinds: list,
  /** Played on any of these maps. */
  maps: list,
  /** One player's plays, for their profile. */
  steamId: z.string().optional(),
  /** Any of these players, the signed-in user (`me`) or people they played with. */
  players: list,
  me: flag,
  playedWith: flag,
  /** Kill tags, all of which some kill in the moment has. */
  tags: list,
  /** Moment tags, all of which the moment has. */
  moments: list,
  /** Won clutches against any of these numbers of opponents. */
  clutch: list,
})

type ClipFilterQuery = z.infer<typeof clipFilterQuery>

/** Elysia may already have split a comma-separated query value into an array. */
const listParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : (value ?? [])

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: string): value is T =>
    values.includes(value as T)

const isOn = (value: ClipFilterQuery['me']) => value === true || value === 'true'

// Bun encodes a string bound as jsonb as a JSON string, so it's bound as text and cast.
const killsHaveTag = (tag: string) =>
  sql`${highlight.kills} @> ${JSON.stringify([{ tags: [tag] }])}::text::jsonb`

/** The feed's filters as a condition on `highlight` joined with its `match`. */
export const clipFilterWhere = (db: Db, userId: string, query: ClipFilterQuery) => {
  const kinds = listParam(query.kinds).filter(oneOf(HIGHLIGHT_KINDS))
  const tags = listParam(query.tags).filter(oneOf(KILL_TAGS))
  const moments = listParam(query.moments).filter(oneOf(MOMENT_TAGS))
  const maps = listParam(query.maps)
  const clutch = listParam(query.clutch).map(Number).filter(Number.isInteger)
  const players = listParam(query.players)
  const who = [
    isOn(query.me) && inUsersMatch(true),
    isOn(query.playedWith) && inUsersMatch(false),
    players.length > 0 && inArray(highlight.steamId, players),
  ].filter((condition) => condition !== false)

  /** Plays from the user's matches: their own, or everyone else's in them. */
  function inUsersMatch(own: boolean) {
    return exists(
      db
        .select({ one: sql`1` })
        .from(userMatch)
        .where(
          and(
            eq(userMatch.userId, userId),
            eq(userMatch.matchId, highlight.matchId),
            own
              ? eq(userMatch.steamId, highlight.steamId)
              : ne(userMatch.steamId, highlight.steamId),
          ),
        ),
    )
  }

  return and(
    kinds.length ? inArray(highlight.kind, kinds) : undefined,
    maps.length ? inArray(match.map, maps) : undefined,
    query.steamId ? eq(highlight.steamId, query.steamId) : undefined,
    who.length ? or(...who) : undefined,
    ...tags.map(killsHaveTag),
    moments.length ? arrayContains(highlight.tags, moments) : undefined,
    clutch.length
      ? and(
          sql`(${highlight.clutch} ->> 'won')::boolean`,
          inArray(sql`(${highlight.clutch} ->> 'opponents')::int`, clutch),
        )
      : undefined,
  )
}

/** What the filters can offer: only values some recorded clip (of `steamId`, when set) has. */
export const clipFacets = async (
  ctx: Pick<Context, 'db' | 'steamApi' | 'log'>,
  steamId?: string,
) => {
  const { db } = ctx
  const recorded =
    and(
      eq(highlight.status, 'recorded'),
      notOneKill,
      steamId ? eq(highlight.steamId, steamId) : undefined,
    ) ?? sql`true`

  const [maps, players, tags, moments, clutches] = await Promise.all([
    db
      .selectDistinct({ map: match.map })
      .from(highlight)
      .innerJoin(match, eq(match.id, highlight.matchId))
      .where(recorded),
    db
      .select({
        steamId: highlight.steamId,
        clips: count(),
        // The name they last played under.
        name: sql<string>`(array_agg(${matchPlayer.name} order by ${playedAt} desc))[1]`,
      })
      .from(highlight)
      .innerJoin(match, eq(match.id, highlight.matchId))
      .innerJoin(
        matchPlayer,
        and(eq(matchPlayer.matchId, highlight.matchId), eq(matchPlayer.steamId, highlight.steamId)),
      )
      .where(recorded)
      .groupBy(highlight.steamId)
      .orderBy(desc(count())),
    db.execute<{ tag: string }>(sql`
      select distinct t as tag
      from ${highlight}
        cross join lateral jsonb_array_elements(${highlight.kills}) k
        cross join lateral jsonb_array_elements_text(k -> 'tags') t
      where ${recorded}`),
    db
      .selectDistinct({ tag: sql<string>`unnest(${highlight.tags})` })
      .from(highlight)
      .where(recorded),
    db
      .selectDistinct({ opponents: sql<number>`(${highlight.clutch} ->> 'opponents')::int` })
      .from(highlight)
      .where(and(recorded, sql`(${highlight.clutch} ->> 'won')::boolean`)),
  ])
  const profiles = await getProfiles(
    ctx,
    players.map((p) => p.steamId),
  )
  const tagSet = new Set(tags.map((t) => t.tag))
  const momentSet = new Set(moments.map((m) => m.tag))

  return {
    maps: maps.flatMap((m) => (m.map ? [m.map] : [])).toSorted(),
    players: players.map((p) => ({
      ...p,
      avatarUrl: profiles.get(p.steamId)?.avatarUrl ?? null,
      vanity: profiles.get(p.steamId)?.vanity ?? null,
    })),
    tags: KILL_TAGS.filter((tag) => tagSet.has(tag)),
    moments: MOMENT_TAGS.filter((tag) => momentSet.has(tag)),
    clutches: clutches
      .map((c) => c.opponents)
      .filter((n) => n >= 2)
      .toSorted((a, b) => a - b),
  }
}
