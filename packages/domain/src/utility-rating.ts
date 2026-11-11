/** Per-round rates mapped onto 0–1 between `from` and `to`, like the parser's aim rating. */
const PARTS = {
  damage: { from: 0, to: 15, weight: 0.5 },
  enemiesFlashed: { from: 0, to: 1, weight: 0.25 },
  flashAssists: { from: 0, to: 0.15, weight: 0.25 },
}

/** Out of 100, from grenade damage, enemies flashed and flash assists per round. */
export const utilityRating = (totals: Record<keyof typeof PARTS, number> & { rounds: number }) => {
  if (!totals.rounds) return null
  let total = 0
  for (const [key, { from, to, weight }] of Object.entries(PARTS)) {
    const rate = totals[key as keyof typeof PARTS] / totals.rounds
    total += weight * Math.min(1, Math.max(0, (rate - from) / (to - from)))
  }

  return Math.round(total * 100)
}
