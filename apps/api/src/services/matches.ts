import { decodeShareCode } from '@subtick/domain'
import { schema } from '@subtick/db'
import { enqueue } from '@subtick/queue'
import type { Context } from '../context'

/**
 * Registers a match for a user. The match row is shared: if anyone already imported it, the user
 * is only linked to it and nothing is resolved or downloaded again.
 */
export const importShareCode = async (
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
