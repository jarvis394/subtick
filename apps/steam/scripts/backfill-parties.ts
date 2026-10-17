/* oxlint-disable no-await-in-loop -- one match at a time: each asks Steam for every player's friend list */
/**
 * Fills in friend-list parties for matches resolved before the steam worker looked them up:
 *   bun run backfill-parties [matchId...]
 * Without ids it does every parsed match that has no parties yet. Writes `match.parties` and
 * each player's `party_id` the way resolving and parsing would.
 */
import { DatabaseEnv, SteamEnv, loadEnv } from '@subtick/config'
import { and, createDb, eq, inArray, isNull, schema } from '@subtick/db'
import { createSteamWebApi } from '@subtick/steam'
import { friendParties } from '../src/parties'

const { match, matchPlayer } = schema
const env = loadEnv({ ...DatabaseEnv, ...SteamEnv })
const db = createDb(env.DATABASE_URL)
const steamApi = createSteamWebApi(env.STEAM_API_KEY)

const ids = Bun.argv.slice(2)
const players = await db
  .select({
    matchId: matchPlayer.matchId,
    steamId: matchPlayer.steamId,
    side: matchPlayer.startingSide,
  })
  .from(matchPlayer)
  .innerJoin(match, eq(match.id, matchPlayer.matchId))
  .where(ids.length ? inArray(match.id, ids) : isNull(match.parties))

const byMatch = Map.groupBy(players, (p) => p.matchId)
for (const [matchId, roster] of byMatch) {
  const parties = await friendParties(
    steamApi,
    roster.map((p) => p.steamId),
  )
  await db.transaction(async (tx) => {
    await tx
      .update(match)
      .set({ parties: Object.keys(parties).length ? parties : null })
      .where(eq(match.id, matchId))
    for (const p of roster) {
      await tx
        .update(matchPlayer)
        .set({ partyId: parties[p.steamId] ? `${parties[p.steamId]}:${p.side}` : null })
        .where(and(eq(matchPlayer.matchId, matchId), eq(matchPlayer.steamId, p.steamId)))
    }
  })
  console.log(matchId, `${new Set(Object.values(parties)).size} parties`)
}
process.exit(0)
