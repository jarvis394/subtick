import { and, asc, count, eq, inArray, isNull, ne, schema, sql } from '@subtick/db'
import { isApproved, isPlaceholderEmail } from '@subtick/domain'
import { approvedMail } from '@subtick/mail'
import type { Context } from '../context'
import { deleteImageObjects } from './profile-images'
import { deleteRecordedHighlight, deleteStoredMatch } from './storage-items'

const { user, steamLink, userMatch, highlight, clip } = schema

const byUser = (rows: { userId: string; n: number }[]) =>
  new Map(rows.map((row) => [row.userId, row.n]))

/** Every account, oldest first, with how much it holds: Steam accounts, matches and recorded clips. */
export const listUsers = async ({ db }: Pick<Context, 'db'>) => {
  const [users, links, matches, clips] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        approvedAt: user.approvedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.createdAt)),
    db.select({ userId: steamLink.userId, n: count() }).from(steamLink).groupBy(steamLink.userId),
    db.select({ userId: userMatch.userId, n: count() }).from(userMatch).groupBy(userMatch.userId),
    db
      .select({ userId: steamLink.userId, n: count() })
      .from(clip)
      .innerJoin(highlight, eq(highlight.id, clip.highlightId))
      .innerJoin(steamLink, eq(steamLink.steamId, highlight.steamId))
      .groupBy(steamLink.userId),
  ])

  const linkCount = byUser(links)
  const matchCount = byUser(matches)
  const clipCount = byUser(clips)

  return users.map(({ email, ...row }) => ({
    ...row,
    pending: !isApproved(row),
    /** Null for Steam sign-ups that never added one. */
    email: isPlaceholderEmail(email) ? null : email,
    steamAccounts: linkCount.get(row.id) ?? 0,
    matches: matchCount.get(row.id) ?? 0,
    clips: clipCount.get(row.id) ?? 0,
  }))
}

export const countPendingUsers = async ({ db }: Pick<Context, 'db'>) => {
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(and(isNull(user.approvedAt), sql`${user.role} is distinct from 'admin'`))

  return row?.n ?? 0
}

/** Lets a waiting account in, and tells its owner when there's a confirmed address to write to. */
export const approveUser = async (
  ctx: Pick<Context, 'db' | 'mailer' | 'log' | 'env'>,
  id: string,
) => {
  const { db, mailer, log, env } = ctx
  const [row] = await db
    .update(user)
    .set({ approvedAt: sql`now()` })
    .where(and(eq(user.id, id), isNull(user.approvedAt)))
    .returning({ email: user.email, emailVerified: user.emailVerified })
  if (!row) {
    const [exists] = await db.select({ id: user.id }).from(user).where(eq(user.id, id))

    return exists ? ('approved' as const) : ('not_found' as const)
  }

  if (row.emailVerified && !isPlaceholderEmail(row.email)) {
    await mailer
      .send(approvedMail({ to: row.email, url: env.PUBLIC_URL }))
      .catch((error) => log.warn({ userId: id }, 'approval mail not sent', error))
  }

  return 'approved' as const
}

export const setUserRole = async (
  { db }: Pick<Context, 'db'>,
  id: string,
  role: 'user' | 'admin',
) => {
  const [row] = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, id))
    .returning({ id: user.id })

  return row ? ('updated' as const) : ('not_found' as const)
}

/**
 * Deletes the account as Settings does: Steam links, sessions and its hold on matches cascade.
 * Matches and clips stay for the other players in them.
 */
export const deleteUser = async ({ db, clips }: Pick<Context, 'db' | 'clips'>, id: string) => {
  const [row] = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ avatar: user.avatarKey, banner: user.bannerKey })
  if (!row) return 'not_found' as const

  await deleteImageObjects(
    clips,
    [row.avatar, row.banner].filter((key) => key != null),
  )

  return 'deleted' as const
}

/**
 * Removes the user's matches. One nobody else holds is deleted for good (demo and clips included);
 * one another user also played stays for them and only leaves this user's history. Matches still
 * being processed are skipped.
 */
export const deleteUserMatches = async (ctx: Context, id: string) => {
  const { db } = ctx
  const heldByOthers = db
    .select({ matchId: userMatch.matchId })
    .from(userMatch)
    .where(ne(userMatch.userId, id))
  const shared = await db
    .delete(userMatch)
    .where(and(eq(userMatch.userId, id), inArray(userMatch.matchId, heldByOthers)))
    .returning({ matchId: userMatch.matchId })
  const solo = await db
    .select({ matchId: userMatch.matchId })
    .from(userMatch)
    .where(eq(userMatch.userId, id))

  let deleted = 0
  let unlinked = shared.length
  let skipped = 0
  for (const { matchId } of solo) {
    // oxlint-disable-next-line no-await-in-loop -- one at a time: each delete also removes S3 objects
    const result = await deleteStoredMatch(ctx, matchId, { soleHolder: id })
    if (result === 'deleted') deleted += 1
    if (result === 'processing') skipped += 1
    // Someone else picked it up since the unlink above.
    if (result === 'shared') {
      // oxlint-disable-next-line no-await-in-loop -- follows the delete it depends on
      await db
        .delete(userMatch)
        .where(and(eq(userMatch.userId, id), eq(userMatch.matchId, matchId)))
      unlinked += 1
    }
  }

  return { deleted, unlinked, skipped }
}

/**
 * Deletes the recordings of the user's moments, in any match. The moments stay as candidates, so
 * they can be recorded again; clips being recorded right now are skipped.
 */
export const deleteUserClips = async (ctx: Context, id: string) => {
  const rows = await ctx.db
    .select({ id: clip.highlightId })
    .from(clip)
    .innerJoin(highlight, eq(highlight.id, clip.highlightId))
    .innerJoin(steamLink, eq(steamLink.steamId, highlight.steamId))
    .where(eq(steamLink.userId, id))

  let deleted = 0
  let skipped = 0
  for (const row of rows) {
    // oxlint-disable-next-line no-await-in-loop -- one at a time: each delete also removes S3 objects
    const result = await deleteRecordedHighlight(ctx, row.id)
    if (result === 'deleted') deleted += 1
    if (result === 'recording') skipped += 1
  }

  return { deleted, skipped }
}
