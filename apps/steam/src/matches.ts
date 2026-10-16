import { schema } from '@subtick/db'
import { decodeShareCode } from '@subtick/domain'
import { enqueue } from '@subtick/queue'
import type { Context } from './context'

/**
 * Registers a match found in someone's history. The match row is global: if it already exists
 * the player is only linked to it, so a match shared by friends is resolved and downloaded once.
 */
export const registerShareCode = async (
  { db, queues }: Pick<Context, 'db' | 'queues'>,
  { userId, steamId, shareCode }: { userId: string; steamId: string; shareCode: string },
) => {
  const matchId = decodeShareCode(shareCode).matchId.toString()
  const [created] = await db
    .insert(schema.match)
    .values({ id: matchId, shareCode })
    .onConflictDoNothing()
    .returning({ id: schema.match.id })
  await db.insert(schema.userMatch).values({ userId, matchId, steamId }).onConflictDoNothing()
  if (created) await enqueue(queues.resolveMatch, { shareCode, userId, steamId })
  return { matchId, isNew: Boolean(created) }
}
