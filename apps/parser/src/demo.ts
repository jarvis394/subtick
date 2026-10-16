/**
 * The only module that talks to demoparser2. Everything it returns is plain, typed data, so the
 * rest of the parser is pure functions that can be tested without a demo file.
 *
 * Every demoparser2 call re-reads the whole demo, so we keep the number of calls small:
 * one pass for game events, one for round snapshots, one for view angles around kills.
 */
import { parseEvents, parseHeader, parsePlayerInfo, parseTicks } from '@laihoe/demoparser2'
import { type Side, WORLD_WEAPON, isSide, sideFromTeamNum } from '@subtick/domain'

export interface DemoHeader {
  map: string
  serverName: string
}

export interface DemoPlayer {
  steamId: string
  name: string
}

interface PlayerRef {
  steamId: string | null
  name: string | null
  teamNum: number | null
}

export interface DemoRoundEnd {
  tick: number
  winner: Side
  reason: string
}

export interface DemoKill {
  tick: number
  attacker: PlayerRef & { health: number | null }
  victim: PlayerRef
  assister: PlayerRef
  assistedFlash: boolean
  weapon: string
  headshot: boolean
  penetrated: number
  noscope: boolean
  throughSmoke: boolean
  attackerBlind: boolean
  attackerInAir: boolean
  /** Meters. */
  distance: number
}

export interface DemoDamage {
  tick: number
  attacker: PlayerRef
  victim: PlayerRef
  weapon: string
  healthDamage: number
  /** Victim health after the hit. */
  healthAfter: number
}

export interface DemoBlind {
  tick: number
  attacker: PlayerRef
  victim: PlayerRef
  /** Seconds. */
  duration: number
}

export interface DemoBombEvent {
  tick: number
  steamId: string | null
}

export interface DemoEvents {
  /** Ticks of `begin_new_match`; the last one marks the real start after warmup/restarts. */
  matchStarts: number[]
  roundStarts: number[]
  freezeEnds: number[]
  buyTimeEnds: number[]
  roundEnds: DemoRoundEnd[]
  kills: DemoKill[]
  damages: DemoDamage[]
  blinds: DemoBlind[]
  bombPlants: DemoBombEvent[]
  bombDefuses: DemoBombEvent[]
}

export interface PlayerSnapshot {
  tick: number
  steamId: string
  teamNum: number
  isAlive: boolean
  equipValue: number
}

export interface ViewAngleSample {
  tick: number
  steamId: string
  pitch: number
  yaw: number
}

export interface Demo {
  header: DemoHeader
  players: DemoPlayer[]
  events: DemoEvents
  /** Player state at the given ticks (we ask for each round's freeze end and buy time end). */
  snapshots(ticks: number[]): PlayerSnapshot[]
  viewAngles(ticks: number[], steamIds: string[]): ViewAngleSample[]
}

const EVENTS = [
  'begin_new_match',
  'round_start',
  'round_freeze_end',
  'buytime_ended',
  'round_end',
  'player_death',
  'player_hurt',
  'player_blind',
  'bomb_planted',
  'bomb_defused',
] as const

// demoparser2 returns untyped rows; this is the single place they are interpreted.
type Row = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' && v !== '' && v !== '0' ? v : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v: unknown) => v === true || v === 1

const ref = (row: Row, prefix: 'attacker' | 'user' | 'assister'): PlayerRef => ({
  steamId: str(row[`${prefix}_steamid`]),
  name: str(row[`${prefix}_name`]),
  teamNum: num(row[`${prefix}_team_num`]),
})

const groupEvents = (rows: Row[]): DemoEvents => {
  const events: DemoEvents = {
    matchStarts: [],
    roundStarts: [],
    freezeEnds: [],
    buyTimeEnds: [],
    roundEnds: [],
    kills: [],
    damages: [],
    blinds: [],
    bombPlants: [],
    bombDefuses: [],
  }

  for (const row of rows) {
    if (row.is_warmup_period === true) continue
    const tick = row.tick as number

    switch (row.event_name as (typeof EVENTS)[number]) {
      case 'begin_new_match':
        events.matchStarts.push(tick)
        break
      case 'round_start':
        events.roundStarts.push(tick)
        break
      case 'round_freeze_end':
        events.freezeEnds.push(tick)
        break
      case 'buytime_ended':
        events.buyTimeEnds.push(tick)
        break
      case 'round_end': {
        const winner = row.winner
        // Draws / restarts have no winner and are not real rounds.
        if (isSide(winner)) {
          events.roundEnds.push({ tick, winner, reason: String(row.reason ?? '') })
        }
        break
      }
      case 'player_death':
        events.kills.push({
          tick,
          attacker: { ...ref(row, 'attacker'), health: num(row.attacker_health) },
          victim: ref(row, 'user'),
          assister: ref(row, 'assister'),
          assistedFlash: bool(row.assistedflash),
          weapon: String(row.weapon ?? WORLD_WEAPON),
          headshot: bool(row.headshot),
          penetrated: num(row.penetrated) ?? 0,
          noscope: bool(row.noscope),
          throughSmoke: bool(row.thrusmoke),
          attackerBlind: bool(row.attackerblind),
          attackerInAir: bool(row.attackerinair),
          distance: num(row.distance) ?? 0,
        })
        break
      case 'player_hurt':
        events.damages.push({
          tick,
          attacker: ref(row, 'attacker'),
          victim: ref(row, 'user'),
          weapon: String(row.weapon ?? WORLD_WEAPON),
          healthDamage: num(row.dmg_health) ?? 0,
          healthAfter: num(row.health) ?? 0,
        })
        break
      case 'player_blind':
        events.blinds.push({
          tick,
          attacker: ref(row, 'attacker'),
          victim: ref(row, 'user'),
          duration: num(row.blind_duration) ?? 0,
        })
        break
      case 'bomb_planted':
        events.bombPlants.push({ tick, steamId: str(row.user_steamid) })
        break
      case 'bomb_defused':
        events.bombDefuses.push({ tick, steamId: str(row.user_steamid) })
        break
    }
  }

  return events
}

export const openDemo = (data: Buffer): Demo => {
  const header = parseHeader(data) as Row
  const players = (parsePlayerInfo(data) as Row[])
    .map((p) => ({ steamId: str(p.steamid), name: String(p.name ?? '') }))
    .filter((p): p is DemoPlayer => p.steamId !== null)

  const rows = parseEvents(data, [...EVENTS], ['team_num', 'health'], ['is_warmup_period']) as Row[]

  return {
    header: {
      map: String(header.map_name ?? 'unknown'),
      serverName: String(header.server_name ?? ''),
    },
    players,
    events: groupEvents(rows.toSorted((a, b) => (a.tick as number) - (b.tick as number))),

    snapshots(ticks) {
      if (ticks.length === 0) return []
      const tickRows = parseTicks(
        data,
        ['team_num', 'is_alive', 'current_equip_value'],
        ticks,
      ) as Row[]
      return tickRows.flatMap((r) => {
        const steamId = str(r.steamid)
        const teamNum = num(r.team_num)
        if (!steamId || teamNum === null || !sideFromTeamNum(teamNum)) return []
        return [
          {
            tick: r.tick as number,
            steamId,
            teamNum,
            isAlive: bool(r.is_alive),
            equipValue: num(r.current_equip_value) ?? 0,
          },
        ]
      })
    },

    viewAngles(ticks, steamIds) {
      if (ticks.length === 0 || steamIds.length === 0) return []
      const angleRows = parseTicks(data, ['pitch', 'yaw'], ticks, steamIds) as Row[]
      return angleRows.flatMap((r) => {
        const steamId = str(r.steamid)
        const pitch = num(r.pitch)
        const yaw = num(r.yaw)
        if (!steamId || pitch === null || yaw === null) return []
        return [{ tick: r.tick as number, steamId, pitch, yaw }]
      })
    },
  }
}
