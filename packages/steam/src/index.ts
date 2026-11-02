/**
 * Minimal typed client for the Steam Web API endpoints subtick needs.
 * https://developer.valvesoftware.com/wiki/Steam_Web_API
 */
import { z } from 'zod'

const BASE_URL = 'https://api.steampowered.com'

export interface SteamProfile {
  steamId: string
  personaName: string
  avatarUrl: string | null
  /** The custom part of steamcommunity.com/id/<vanity>, when the player set one. */
  vanity: string | null
}

export type NextShareCodeResult =
  | { status: 'next'; shareCode: string }
  /** The known code is the latest one. */
  | { status: 'none' }
  /** The auth code does not belong to this Steam account (or was revoked). */
  | { status: 'invalid_auth_code' }
  /** The known share code is not one of this account's matches. */
  | { status: 'invalid_share_code' }
  /** HTTP 429: Valve is throttling the API key. `retryAfterMs` is from `Retry-After`, if sent. */
  | { status: 'rate_limited'; retryAfterMs: number | null }

export class SteamApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
  ) {
    super(`Steam Web API ${endpoint} failed with HTTP ${status}`)
  }
}

const PlayerSummaries = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        personaname: z.string(),
        avatarfull: z.string().optional(),
        profileurl: z.string().optional(),
      }),
    ),
  }),
})

const FriendList = z.object({
  friendslist: z.object({ friends: z.array(z.object({ steamid: z.string() })) }),
})

/** success 1 = found; 42 = no profile has this vanity URL. */
const ResolveVanityUrl = z.object({
  response: z.object({ success: z.number(), steamid: z.string().optional() }),
})

/** `Retry-After` as milliseconds: either delay-seconds or an HTTP date. */
const retryAfterMs = (header: string | null) => {
  if (!header) return null
  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now()

  return Number.isFinite(ms) && ms > 0 ? ms : null
}

const vanityOf = (profileUrl?: string) => profileUrl?.match(/\/id\/([^/]+)\/?$/)?.[1] ?? null

const NextMatchSharingCode = z.object({ result: z.object({ nextcode: z.string() }) })

export const createSteamWebApi = (apiKey: string) => {
  const get = (path: string, params: Record<string, string>) =>
    fetch(`${BASE_URL}${path}?${new URLSearchParams({ key: apiKey, ...params })}`, {
      signal: AbortSignal.timeout(10_000),
    })

  /** Public profiles for any number of players (batched 100 per request, Valve's limit). */
  const getProfiles = async (steamIds: string[]): Promise<SteamProfile[]> => {
    const endpoint = '/ISteamUser/GetPlayerSummaries/v2/'
    const batches = Array.from({ length: Math.ceil(steamIds.length / 100) }, (_, i) =>
      steamIds.slice(i * 100, i * 100 + 100),
    )
    const responses = await Promise.all(
      batches.map(async (batch) => {
        const response = await get(endpoint, { steamids: batch.join(',') })
        if (!response.ok) throw new SteamApiError(endpoint, response.status)

        return PlayerSummaries.parse(await response.json()).response.players
      }),
    )

    return responses.flat().map((player) => ({
      steamId: player.steamid,
      personaName: player.personaname,
      avatarUrl: player.avatarfull ?? null,
      vanity: vanityOf(player.profileurl),
    }))
  }

  return {
    getProfiles,

    async getProfile(steamId: string): Promise<SteamProfile | null> {
      const [profile] = await getProfiles([steamId])

      return profile ?? null
    },

    /** The Steam ID behind a steamcommunity.com/id/<vanity> URL, or null when none has it. */
    async resolveVanity(vanity: string): Promise<string | null> {
      const endpoint = '/ISteamUser/ResolveVanityURL/v1/'
      const response = await get(endpoint, { vanityurl: vanity })
      if (!response.ok) throw new SteamApiError(endpoint, response.status)
      const { success, steamid } = ResolveVanityUrl.parse(await response.json()).response

      return success === 1 ? (steamid ?? null) : null
    },

    /** A player's Steam friends, or null when their friend list is private. */
    async getFriendIds(steamId: string): Promise<string[] | null> {
      const endpoint = '/ISteamUser/GetFriendList/v1/'
      const response = await get(endpoint, { steamid: steamId, relationship: 'friend' })
      if (response.status === 401 || response.status === 403) return null
      if (!response.ok) throw new SteamApiError(endpoint, response.status)

      return FriendList.parse(await response.json()).friendslist.friends.map((f) => f.steamid)
    },

    /** Walks a player's match history one share code at a time. */
    async getNextShareCode(input: {
      steamId: string
      authCode: string
      knownCode: string
    }): Promise<NextShareCodeResult> {
      const endpoint = '/ICSGOPlayers_730/GetNextMatchSharingCode/v1/'
      const response = await get(endpoint, {
        steamid: input.steamId,
        steamidkey: input.authCode,
        knowncode: input.knownCode,
      })
      if (response.status === 403) return { status: 'invalid_auth_code' }
      if (response.status === 412) return { status: 'invalid_share_code' }
      if (response.status === 429) {
        return {
          status: 'rate_limited',
          retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
        }
      }
      // 202 = no newer match yet.
      if (response.status === 202) return { status: 'none' }
      if (!response.ok) throw new SteamApiError(endpoint, response.status)
      const { nextcode } = NextMatchSharingCode.parse(await response.json()).result

      return nextcode === 'n/a' ? { status: 'none' } : { status: 'next', shareCode: nextcode }
    },
  }
}

export type SteamWebApi = ReturnType<typeof createSteamWebApi>
