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
      /** The demo URL once the match is over; there is no map name anywhere in the reply. */
      map: string | null
      reservation: Reservation | null
      /** `[0]` is the team of `account_ids[0..4]`, which is the team that started CT. */
      team_scores: number[]
      /** 24 for Premier and Competitive (MR12), 16 for Wingman. */
      max_rounds: number | null
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
