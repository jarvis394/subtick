import { type ClipSegment, type KillTag, type Side, clipSegments, otherSide } from '@subtick/domain'
import { WEAPON_ICON_NAMES } from '@/lib/killfeed-icons'
import type { MatchDetail } from '@/lib/queries'

/**
 * CS2 killfeed icons (scripts/fetch-killfeed-icons.ts), white on transparent. They're plain files
 * in public/ rather than imports, so nothing is bundled or requested until an <img> shows one.
 */
const WEAPON_ICONS = new Set<string>(WEAPON_ICON_NAMES)

const weaponUrl = (name: string) =>
  WEAPON_ICONS.has(name) ? `/killfeed/weapons/${name}.svg` : undefined
const tagUrl = (name: string) => `/killfeed/${name}.svg`

/** Event weapon ids that have a differently named icon. */
const WEAPON_ALIASES: Record<string, string> = {
  planted_c4: 'c4',
  knife_default_ct: 'knife',
  knife_default_t: 'knife_t',
}

export const weaponIcon = (weapon: string) =>
  weaponUrl(WEAPON_ALIASES[weapon] ?? weapon) ??
  (weapon.startsWith('knife') ? weaponUrl('knife') : undefined)

export const HEADSHOT_ICON = tagUrl('headshot')
export const DEFUSE_ICON = tagUrl('defuse')
export const BOMB_ICON = tagUrl('bomb')
export const BOMB_EXPLODED_ICON = tagUrl('bomb_exploded')

/** Modifiers in the order CS2 draws them after the weapon. */
const AFTER_WEAPON: KillTag[] = ['noscope', 'smoke', 'wallbang', 'headshot']

export const modifierIcons = (tags: KillTag[]) =>
  AFTER_WEAPON.filter((t) => tags.includes(t)).map((t) => ({ tag: t, src: tagUrl(t) }))

export const BLIND_ICON = tagUrl('blind')

type Round = MatchDetail['rounds'][number]

/** Teams swap sides at half time and in overtime; a round's winner vs its winning team tells which way. */
export const sideInRound = (startingSide: Side, round: Round | undefined): Side =>
  round?.winnerTeam && round.winner !== round.winnerTeam ? otherSide(startingSide) : startingSide

type FeedPlayer = { steamId: string; name: string; side: Side }

export interface KillEntry {
  type: 'kill'
  tick: number
  attacker: FeedPlayer | null
  assister: FeedPlayer | null
  victim: FeedPlayer
  weapon: string
  tags: KillTag[]
}

export interface BombEntry {
  type: 'planted' | 'defused' | 'exploded'
  tick: number
  /** The planter or defuser; nobody for an explosion. */
  player: FeedPlayer | null
}

export type FeedEntry = KillEntry | BombEntry

/** Every kill and bomb event of the round the moment's clip shows, oldest first. */
export const momentFeed = (
  data: Pick<MatchDetail, 'kills' | 'players' | 'rounds'>,
  moment: { round: number; startTick: number; endTick: number; segments: ClipSegment[] },
): FeedEntry[] => {
  const segments = clipSegments(moment)
  const inClip = (tick: number) => segments.some((s) => tick >= s.startTick && tick <= s.endTick)
  const round = data.rounds.find((r) => r.number === moment.round)
  const players = new Map(data.players.map((p) => [p.steamId, p]))
  const person = (steamId: string | null) => {
    const p = steamId ? players.get(steamId) : undefined
    return p?.startingSide
      ? { steamId: p.steamId, name: p.name, side: sideInRound(p.startingSide, round) }
      : null
  }

  const kills = data.kills
    .filter((k) => k.round === moment.round && inClip(k.tick))
    .flatMap((k): KillEntry[] => {
      const victim = person(k.victimSteamId)
      if (!victim) return []
      return [
        {
          type: 'kill',
          tick: k.tick,
          attacker: person(k.attackerSteamId),
          assister: person(k.assisterSteamId),
          victim,
          weapon: k.weapon,
          tags: k.tags as KillTag[],
        },
      ]
    })

  const bomb = (
    [
      ['planted', round?.bombPlantTick, round?.bombPlanterSteamId],
      ['defused', round?.bombDefuseTick, round?.bombDefuserSteamId],
      ['exploded', round?.bombExplodeTick, null],
    ] as const
  ).flatMap(([type, tick, steamId]): BombEntry[] =>
    tick != null && inClip(tick) ? [{ type, tick, player: person(steamId ?? null) }] : [],
  )

  return [...kills, ...bomb].toSorted((a, b) => a.tick - b.tick)
}
