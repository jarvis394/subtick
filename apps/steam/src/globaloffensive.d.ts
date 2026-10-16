/** The subset of `globaloffensive` subtick uses; the package ships no types. */
declare module 'globaloffensive' {
  import type { EventEmitter } from 'node:events'
  import type SteamUser from 'steam-user'

  namespace GlobalOffensive {
    /** Decoded protobuf objects: 64-bit ints are strings, unset scalars are null. */
    interface Reservation {
      account_ids: number[]
      party_ids: number[]
    }
    interface RoundStats {
      map: string | null
      reservation: Reservation | null
      team_scores: number[]
    }
    interface MatchInfo {
      matchid: string | null
      matchtime: number | null
      roundstatsall: RoundStats[]
    }
  }

  class GlobalOffensive extends EventEmitter {
    constructor(steamUser: SteamUser)
    haveGCSession: boolean
    requestGame(shareCode: string): void
    on(event: 'connectedToGC', listener: () => void): this
    on(event: 'disconnectedFromGC', listener: (reason: number) => void): this
    on(event: 'matchList', listener: (matches: GlobalOffensive.MatchInfo[]) => void): this
    off(event: 'connectedToGC', listener: () => void): this
    off(event: 'matchList', listener: (matches: GlobalOffensive.MatchInfo[]) => void): this
  }

  export = GlobalOffensive
}
