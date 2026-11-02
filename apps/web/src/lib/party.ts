/** Symbol + color per party, so teammates who queued together are easy to spot. */
export interface PartyMarker {
  symbol: 'circle' | 'square' | 'triangle' | 'diamond' | 'star'
  color: string
}

const MARKERS: PartyMarker[] = [
  { symbol: 'circle', color: '#4fb8ac' },
  { symbol: 'diamond', color: '#e3a33b' },
  { symbol: 'triangle', color: '#9d7ce6' },
  { symbol: 'square', color: '#e2708f' },
  { symbol: 'star', color: '#6aa6e6' },
]

/** Only parties of 2+ players present in the match get a marker; solo queuers get none. */
export const partyMarkers = (players: { steamId: string; partyId: string | null }[]) => {
  const sizes = new Map<string, number>()
  for (const p of players) if (p.partyId) sizes.set(p.partyId, (sizes.get(p.partyId) ?? 0) + 1)

  const byParty = new Map<string, PartyMarker>()
  const markers = new Map<string, PartyMarker>()
  for (const p of players) {
    if (!p.partyId || (sizes.get(p.partyId) ?? 0) < 2) continue
    if (!byParty.has(p.partyId)) byParty.set(p.partyId, MARKERS[byParty.size % MARKERS.length]!)
    markers.set(p.steamId, byParty.get(p.partyId)!)
  }

  return markers
}
