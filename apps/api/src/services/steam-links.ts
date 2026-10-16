import { type Db, schema } from '@subtick/db'
import type { SteamWebApi } from '@subtick/steam'

/** Creates or refreshes the Steam link (persona, avatar) after sign-in or linking. */
export const upsertSteamLink = async (
  { db, steamApi }: { db: Db; steamApi: SteamWebApi },
  userId: string,
  steamId: string,
) => {
  const profile = await steamApi.getProfile(steamId)
  const values = {
    userId,
    personaName: profile?.personaName ?? steamId,
    avatarUrl: profile?.avatarUrl ?? null,
  }
  await db
    .insert(schema.steamLink)
    .values({ steamId, ...values })
    .onConflictDoUpdate({ target: schema.steamLink.steamId, set: values })
}
