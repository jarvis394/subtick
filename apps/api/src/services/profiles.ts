import { eq, inArray, schema, sql } from '@subtick/db'
import type { Context } from '../context'

const STALE_MS = 7 * 24 * 3600 * 1000

export interface PlayerProfile {
  personaName: string
  avatarUrl: string | null
  vanity: string | null
}

/**
 * Steam names/avatars for any players, from the `steam_profile` cache. Missing or stale entries
 * are refreshed with one batched Steam call; if Steam is down, callers just get what is cached.
 */
export const getProfiles = async (
  { db, steamApi, log }: Pick<Context, 'db' | 'steamApi' | 'log'>,
  steamIds: string[],
): Promise<Map<string, PlayerProfile>> => {
  const ids = [...new Set(steamIds)]
  if (!ids.length) return new Map()

  const cached = await db
    .select()
    .from(schema.steamProfile)
    .where(inArray(schema.steamProfile.steamId, ids))
  const profiles = new Map<string, PlayerProfile>(cached.map((p) => [p.steamId, p]))

  const fresh = new Set(
    cached.filter((p) => Date.now() - p.fetchedAt.getTime() < STALE_MS).map((p) => p.steamId),
  )
  const stale = ids.filter((id) => !fresh.has(id))
  if (!stale.length) return profiles

  try {
    const fetched = await steamApi.getProfiles(stale)
    if (fetched.length) {
      await db
        .insert(schema.steamProfile)
        .values(fetched.map((p) => ({ ...p, fetchedAt: new Date() })))
        .onConflictDoUpdate({
          target: schema.steamProfile.steamId,
          set: {
            personaName: sql`excluded.persona_name`,
            avatarUrl: sql`excluded.avatar_url`,
            vanity: sql`excluded.vanity`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        })
    }
    for (const p of fetched) profiles.set(p.steamId, p)
  } catch (error) {
    log.warn({ count: stale.length }, 'steam profile refresh failed', error)
  }

  return profiles
}

/** A profile URL's player: a Steam ID as is, or a vanity looked up in the cache, then on Steam. */
export const resolvePlayer = async (
  ctx: Pick<Context, 'db' | 'steamApi' | 'log'>,
  slug: string,
): Promise<string | null> => {
  if (/^\d{17}$/.test(slug)) return slug

  const [cached] = await ctx.db
    .select({ steamId: schema.steamProfile.steamId })
    .from(schema.steamProfile)
    .where(eq(sql`lower(${schema.steamProfile.vanity})`, slug.toLowerCase()))
    .orderBy(sql`${schema.steamProfile.fetchedAt} desc`)
    .limit(1)
  if (cached) return cached.steamId

  try {
    const steamId = await ctx.steamApi.resolveVanity(slug)
    // Cache the profile, so the next visit resolves without Steam.
    if (steamId) await getProfiles(ctx, [steamId])

    return steamId
  } catch (error) {
    ctx.log.warn({ slug }, 'steam vanity lookup failed', error)

    return null
  }
}
