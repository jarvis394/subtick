/** Weapon id of world/fall deaths, used when an event has none. */
export const WORLD_WEAPON = 'world'

export type WeaponClass =
  | 'pistol'
  | 'smg'
  | 'heavy'
  | 'rifle'
  | 'sniper'
  | 'knife'
  | 'taser'
  | 'grenade'
  | 'other'

const WEAPONS: Record<string, [name: string, cls: WeaponClass]> = {
  glock: ['Glock-18', 'pistol'],
  hkp2000: ['P2000', 'pistol'],
  usp_silencer: ['USP-S', 'pistol'],
  p250: ['P250', 'pistol'],
  elite: ['Dual Berettas', 'pistol'],
  fiveseven: ['Five-SeveN', 'pistol'],
  tec9: ['Tec-9', 'pistol'],
  cz75a: ['CZ75-Auto', 'pistol'],
  deagle: ['Desert Eagle', 'pistol'],
  revolver: ['R8 Revolver', 'pistol'],
  mac10: ['MAC-10', 'smg'],
  mp9: ['MP9', 'smg'],
  mp7: ['MP7', 'smg'],
  mp5sd: ['MP5-SD', 'smg'],
  ump45: ['UMP-45', 'smg'],
  p90: ['P90', 'smg'],
  bizon: ['PP-Bizon', 'smg'],
  nova: ['Nova', 'heavy'],
  xm1014: ['XM1014', 'heavy'],
  sawedoff: ['Sawed-Off', 'heavy'],
  mag7: ['MAG-7', 'heavy'],
  m249: ['M249', 'heavy'],
  negev: ['Negev', 'heavy'],
  galilar: ['Galil AR', 'rifle'],
  famas: ['FAMAS', 'rifle'],
  ak47: ['AK-47', 'rifle'],
  m4a1: ['M4A4', 'rifle'],
  m4a1_silencer: ['M4A1-S', 'rifle'],
  sg556: ['SG 553', 'rifle'],
  aug: ['AUG', 'rifle'],
  ssg08: ['SSG 08', 'sniper'],
  awp: ['AWP', 'sniper'],
  g3sg1: ['G3SG1', 'sniper'],
  scar20: ['SCAR-20', 'sniper'],
  taser: ['Zeus x27', 'taser'],
  hegrenade: ['HE Grenade', 'grenade'],
  inferno: ['Molotov', 'grenade'],
  molotov: ['Molotov', 'grenade'],
  incgrenade: ['Incendiary', 'grenade'],
  flashbang: ['Flashbang', 'grenade'],
  smokegrenade: ['Smoke Grenade', 'grenade'],
  decoy: ['Decoy', 'grenade'],
  planted_c4: ['C4', 'other'],
  [WORLD_WEAPON]: ['World', 'other'],
}

/** Weapon ids as they appear in game events (`ak47`, `knife_karambit`, …). */
export const weaponClass = (id: string): WeaponClass =>
  WEAPONS[id]?.[1] ?? (id.startsWith('knife') || id === 'bayonet' ? 'knife' : 'other')

export const weaponName = (id: string): string =>
  WEAPONS[id]?.[0] ?? (weaponClass(id) === 'knife' ? 'Knife' : id)
