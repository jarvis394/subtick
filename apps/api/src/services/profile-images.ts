import { eq, inArray, schema } from '@subtick/db'
import type { Context } from '../context'

export type ProfileImage = 'avatar' | 'banner'

/** Upload limits. The browser crops and re-encodes to WebP first, so real files are far smaller. */
export const IMAGE_LIMITS: Record<ProfileImage, { maxBytes: number }> = {
  avatar: { maxBytes: 1_000_000 },
  banner: { maxBytes: 3_000_000 },
}

export const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png']

const EXTENSION: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Kept apart from clip keys (`<uuid>.mp4`), which the storage report and cleanup go by. */
export const PROFILE_PREFIX = 'profiles/'

const column = { avatar: 'avatarKey', banner: 'bannerKey' } as const

/** Profile pictures live in the clips bucket: it's the one browsers can reach. */
export const imageUrl = ({ clips }: Pick<Context, 'clips'>, key: string | null) =>
  key ? clips.presign(key, 24 * 3600) : null

/** Stores a new picture and drops the old one; a fresh key per upload busts browser caches. */
export const replaceImage = async (
  { db, clips, log }: Pick<Context, 'db' | 'clips' | 'log'>,
  userId: string,
  kind: ProfileImage,
  file: File | null,
) => {
  const [current] = await db
    .select({ key: schema.user[column[kind]] })
    .from(schema.user)
    .where(eq(schema.user.id, userId))

  let key: string | null = null
  if (file) {
    key = `${PROFILE_PREFIX}${userId}/${kind}-${crypto.randomUUID()}.${EXTENSION[file.type]}`
    await clips.put(key, file, file.type)
  }
  await db
    .update(schema.user)
    .set({ [column[kind]]: key })
    .where(eq(schema.user.id, userId))

  // The row no longer points at it, so a failed delete only leaves an unused object.
  if (current?.key) {
    await clips.delete(current.key).catch((error) => {
      log.warn({ key: current.key }, 'old profile image not deleted', error)
    })
  }

  return imageUrl({ clips }, key)
}

export interface SubtickIdentity {
  userId: string
  name: string
  avatarKey: string | null
  bannerKey: string | null
  memberSince: Date
}

/** The subtick account behind each Steam id that has one, for display names and pictures. */
export const subtickIdentities = async ({ db }: Pick<Context, 'db'>, steamIds: string[]) => {
  if (!steamIds.length) return new Map<string, SubtickIdentity>()
  const rows = await db
    .select({
      steamId: schema.steamLink.steamId,
      userId: schema.user.id,
      name: schema.user.name,
      avatarKey: schema.user.avatarKey,
      bannerKey: schema.user.bannerKey,
      memberSince: schema.user.createdAt,
    })
    .from(schema.steamLink)
    .innerJoin(schema.user, eq(schema.user.id, schema.steamLink.userId))
    .where(inArray(schema.steamLink.steamId, [...new Set(steamIds)]))

  return new Map(rows.map(({ steamId, ...identity }) => [steamId, identity]))
}
