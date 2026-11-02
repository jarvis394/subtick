const MAP_NAMES: Record<string, string> = {
  de_ancient: 'Ancient',
  de_anubis: 'Anubis',
  de_cache: 'Cache',
  de_dust2: 'Dust II',
  de_inferno: 'Inferno',
  de_mirage: 'Mirage',
  de_nuke: 'Nuke',
  de_overpass: 'Overpass',
  de_train: 'Train',
  de_vertigo: 'Vertigo',
  cs_italy: 'Italy',
  cs_office: 'Office',
}

/** `de_inferno` → `Inferno`; unknown maps lose their prefix and get capitalized. */
export const mapName = (id: string | null | undefined) => {
  if (!id) return 'Unknown map'
  const bare = id.replace(/^(de|cs|ar|dz)_/, '')

  return MAP_NAMES[id] ?? bare.charAt(0).toUpperCase() + bare.slice(1)
}
