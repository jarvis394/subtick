import { chmod, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { accountIdToSteamId } from '@subtick/domain'
import type { Logger } from '@subtick/logger'
import GlobalOffensive from 'globaloffensive'
import SteamUser from 'steam-user'
import SteamTotp from 'steam-totp'

const CS2_APP_ID = 730
const CONNECT_TIMEOUT_MS = 60_000
const REQUEST_TIMEOUT_MS = 20_000

export interface BotCredentials {
  username: string
  password: string
  sharedSecret?: string
  /** One-off emailed Steam Guard code, only needed for the very first login. */
  guardCode?: string
}

export interface ResolvedMatch {
  /** Null when Valve no longer has the demo. */
  demoUrl: string | null
  playedAt: Date | null
  /**
   * steamId64 → party id; players who queued alone are left out. So far CS2's GC has sent
   * `party_ids` empty, so this is usually empty too.
   */
  parties: Record<string, string>
}

export class GcUnavailableError extends Error {}

/**
 * One logged-in bot account and its CS2 Game Coordinator session, shared by every job in the
 * process. Connects on first use and reconnects on its own (steam-user relogs, globaloffensive
 * re-handshakes); requests must be serialized, which the resolve worker's concurrency of 1 does.
 */
export const createGameCoordinator = (
  credentials: BotCredentials,
  { dataDir, log }: { dataDir: string; log: Logger<unknown> },
) => {
  const tokenPath = join(dataDir, `refresh-token-${credentials.username}`)
  const user = new SteamUser({
    autoRelogin: true,
    renewRefreshTokens: true,
    dataDirectory: null,
    // steam-user's WebSocket transport never connects under Bun 1.3; raw TCP does.
    protocol: SteamUser.EConnectionProtocol.TCP,
  })
  const gc = new GlobalOffensive(user)
  let ready: Promise<void> | null = null

  user.on('refreshToken', async (token) => {
    await mkdir(dataDir, { recursive: true })
    await Bun.write(tokenPath, token)
    await chmod(tokenPath, 0o600)
  })
  user.on('loggedOn', () => {
    log.info({ steamId: user.steamID?.getSteamID64() }, 'bot logged on')
    user.gamesPlayed([CS2_APP_ID])
  })
  user.on('steamGuard', (domain, callback, lastCodeWrong) => {
    if (credentials.sharedSecret && !lastCodeWrong)
      return callback(SteamTotp.generateAuthCode(credentials.sharedSecret))
    if (credentials.guardCode && !lastCodeWrong) return callback(credentials.guardCode)
    log.error(
      { domain, lastCodeWrong },
      'Steam Guard code required: set STEAM_BOT_SHARED_SECRET, or STEAM_BOT_GUARD_CODE once',
    )
    user.logOff()
  })
  user.on('error', (error) => log.error('bot error', error))
  gc.on('disconnectedFromGC', (reason) => log.warn({ reason }, 'disconnected from GC'))

  const logOn = async () => {
    const saved = Bun.file(tokenPath)
    if (await saved.exists()) {
      user.logOn({ refreshToken: (await saved.text()).trim() })
    } else {
      user.logOn({ accountName: credentials.username, password: credentials.password })
    }
  }

  const connect = () =>
    new Promise<void>((resolve, reject) => {
      if (gc.haveGCSession) return resolve()
      const timer = setTimeout(() => {
        cleanup()
        reject(new GcUnavailableError('Timed out connecting to the CS2 Game Coordinator'))
      }, CONNECT_TIMEOUT_MS)
      const onReady = () => {
        cleanup()
        log.info('connected to GC')
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        reject(new GcUnavailableError(`Steam login failed: ${error.message}`))
      }
      const cleanup = () => {
        clearTimeout(timer)
        gc.off('connectedToGC', onReady)
        user.off('error', onError)
      }
      gc.on('connectedToGC', onReady)
      user.once('error', onError)
      if (!user.steamID) void logOn().catch(onError)
    })

  const ensureSession = () => {
    if (gc.haveGCSession) return Promise.resolve()
    ready ??= connect().finally(() => (ready = null))
    return ready
  }

  return {
    /** Full match info for a share code: demo URL, start time and parties from the reservation. */
    async resolve(shareCode: string, matchId: string): Promise<ResolvedMatch> {
      await ensureSession()
      const info = await new Promise<GlobalOffensive.MatchInfo>((resolve, reject) => {
        const timer = setTimeout(() => {
          gc.off('matchList', onList)
          reject(new GcUnavailableError('The Game Coordinator did not answer in time'))
        }, REQUEST_TIMEOUT_MS)
        const onList = (matches: GlobalOffensive.MatchInfo[]) => {
          const found = matches.find((m) => m.matchid === matchId)
          if (!found) return
          clearTimeout(timer)
          gc.off('matchList', onList)
          resolve(found)
        }
        gc.on('matchList', onList)
        gc.requestGame(shareCode)
      })

      // Round stats arrive once per round; the last one carries the final demo URL.
      const last = info.roundstatsall.at(-1)
      const reservation = info.roundstatsall.find((r) => r.reservation)?.reservation
      return {
        demoUrl: last?.map || null,
        playedAt: info.matchtime ? new Date(info.matchtime * 1000) : null,
        parties: reservation ? partiesOf(reservation) : {},
      }
    },

    close() {
      user.logOff()
    },
  }
}

export type GameCoordinator = ReturnType<typeof createGameCoordinator>

/** `party_ids[i]` belongs to `account_ids[i]`; 0 means the player queued alone. */
const partiesOf = ({ account_ids, party_ids }: GlobalOffensive.Reservation) => {
  const parties: Record<string, string> = {}
  account_ids.forEach((accountId, i) => {
    const party = party_ids[i]
    if (party) parties[accountIdToSteamId(accountId)] = String(party)
  })
  return parties
}
