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
}

export type NextShareCodeResult =
  | { status: 'next'; shareCode: string }
  /** The known code is the latest one. */
  | { status: 'none' }
  /** The auth code does not belong to this Steam account (or was revoked). */
  | { status: 'invalid_auth_code' }
  /** The known share code is not one of this account's matches. */
  | { status: 'invalid_share_code' }

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
      z.object({ steamid: z.string(), personaname: z.string(), avatarfull: z.string().optional() }),
    ),
  }),
})

const NextMatchSharingCode = z.object({ result: z.object({ nextcode: z.string() }) })

export const createSteamWebApi = (apiKey: string) => {
  const get = (path: string, params: Record<string, string>) =>
    fetch(`${BASE_URL}${path}?${new URLSearchParams({ key: apiKey, ...params })}`, {
      signal: AbortSignal.timeout(10_000),
    })

  return {
    async getProfile(steamId: string): Promise<SteamProfile | null> {
      const endpoint = '/ISteamUser/GetPlayerSummaries/v2/'
      const response = await get(endpoint, { steamids: steamId })
      if (!response.ok) throw new SteamApiError(endpoint, response.status)
      const [player] = PlayerSummaries.parse(await response.json()).response.players
      return player
        ? {
            steamId: player.steamid,
            personaName: player.personaname,
            avatarUrl: player.avatarfull ?? null,
          }
        : null
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
      // 202 = no newer match yet.
      if (response.status === 202) return { status: 'none' }
      if (!response.ok) throw new SteamApiError(endpoint, response.status)
      const { nextcode } = NextMatchSharingCode.parse(await response.json()).result
      return nextcode === 'n/a' ? { status: 'none' } : { status: 'next', shareCode: nextcode }
    },
  }
}

export type SteamWebApi = ReturnType<typeof createSteamWebApi>
