import { type KillTag, type Side, otherSide } from '@subtick/domain'
import type { MatchDetail } from '@/lib/queries'

/** CS2 killfeed icons (scripts/fetch-killfeed-icons.ts), white on transparent. */
const weaponIcons = import.meta.glob<string>('../assets/killfeed/weapons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const tagIcons = import.meta.glob<string>('../assets/killfeed/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const iconByName = (icons: Record<string, string>) =>
  new Map(Object.entries(icons).map(([path, url]) => [path.split('/').at(-1)!.slice(0, -4), url]))
const WEAPON_ICONS = iconByName(weaponIcons)
const TAG_ICONS = iconByName(tagIcons)

/** Event weapon ids that have a differently named icon. */
const WEAPON_ALIASES: Record<string, string> = {
  planted_c4: 'c4',
  knife_default_ct: 'knife',
  knife_default_t: 'knife_t',
}

export const weaponIcon = (weapon: string) =>
  WEAPON_ICONS.get(WEAPON_ALIASES[weapon] ?? weapon) ??
  (weapon.startsWith('knife') ? WEAPON_ICONS.get('knife') : undefined)

export const SKULL_ICON = TAG_ICONS.get('skull')!

/** Modifiers in the order CS2 draws them after the weapon. */
const AFTER_WEAPON: KillTag[] = ['noscope', 'smoke', 'wallbang', 'headshot']

export const modifierIcons = (tags: KillTag[]) =>
  AFTER_WEAPON.filter((t) => tags.includes(t)).map((t) => ({ tag: t, src: TAG_ICONS.get(t)! }))

export const BLIND_ICON = TAG_ICONS.get('blind')!

type Round = MatchDetail['rounds'][number]

/** Teams swap sides at half time and in overtime; a round's winner vs its winning team tells which way. */
export const sideInRound = (startingSide: Side, round: Round | undefined): Side =>
  round?.winnerTeam && round.winner !== round.winnerTeam ? otherSide(startingSide) : startingSide

export interface FeedEntry {
  tick: number
  attacker: { steamId: string; name: string; side: Side } | null
  assister: { name: string; side: Side } | null
  victim: { steamId: string; name: string; side: Side }
  weapon: string
  tags: KillTag[]
}

/** Every kill of the round inside the moment's window, oldest first. */
export const momentFeed = (
  data: Pick<MatchDetail, 'kills' | 'players' | 'rounds'>,
  moment: { round: number; startTick: number; endTick: number },
): FeedEntry[] => {
  const round = data.rounds.find((r) => r.number === moment.round)
  const players = new Map(data.players.map((p) => [p.steamId, p]))
  const person = (steamId: string | null) => {
    const p = steamId ? players.get(steamId) : undefined
    return p?.startingSide
      ? { steamId: p.steamId, name: p.name, side: sideInRound(p.startingSide, round) }
      : null
  }

  return data.kills
    .filter(
      (k) => k.round === moment.round && k.tick >= moment.startTick && k.tick <= moment.endTick,
    )
    .flatMap((k) => {
      const victim = person(k.victimSteamId)
      if (!victim) return []
      return [
        {
          tick: k.tick,
          attacker: person(k.attackerSteamId),
          assister: person(k.assisterSteamId),
          victim,
          weapon: k.weapon,
          tags: k.tags as KillTag[],
        },
      ]
    })
}
