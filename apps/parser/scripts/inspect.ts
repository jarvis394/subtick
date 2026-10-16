/**
 * Prints the scoreboard and highlights of a demo — the fastest loop for tuning detectors.
 *   bun run inspect test/fixtures/<demo>.dem
 */
import { ticksToSeconds } from '@subtick/domain'
import { analyzeDemo, readDemoFile } from '../src/analyze'

const path = process.argv[2]
if (!path) throw new Error('usage: bun scripts/inspect.ts <demo.dem>')

console.time('analyze')
const { timeline, stats, highlights, clutches } = analyzeDemo(await readDemoFile(path))
console.timeEnd('analyze')

const time = (tick: number) => {
  const s = Math.floor(ticksToSeconds(tick))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

console.log(
  `\n${timeline.header.map} · ${timeline.finalScore.CT}:${timeline.finalScore.T} · ${timeline.rounds.length} rounds\n`,
)
console.table(
  [...stats]
    .map(([id, s]) => ({
      name: timeline.players.get(id)?.name,
      side: timeline.players.get(id)?.startingSide,
      K: s.kills,
      D: s.deaths,
      A: s.assists,
      ADR: s.adr,
      'HS%': s.hsPercent,
      'KAST%': s.kastPercent,
      '5k/4k/3k': `${s.multiKills[4]}/${s.multiKills[3]}/${s.multiKills[2]}`,
      clutch: `${s.clutchesWon}/${s.clutchesAttempted}`,
      rating: s.rating,
    }))
    .toSorted((a, b) => b.rating - a.rating),
)

console.log(
  `clutches: ${clutches.map((c) => `r${c.round} 1v${c.opponents}${c.won ? '✓' : '✗'}`).join(', ')}\n`,
)
for (const h of highlights.toSorted((a, b) => b.score - a.score)) {
  const dur = ticksToSeconds(h.endTick - h.startTick).toFixed(1)
  const kills = h.kills
    .map((k) => `${k.weapon}${k.tags.length ? `[${k.tags.join(',')}]` : ''}`)
    .join(' ')
  console.log(
    `${String(h.score).padStart(6)}  r${String(h.round).padEnd(3)} ${time(h.startTick)} (${dur}s)  ${h.playerName.padEnd(20)} ${h.kind.padEnd(10)} ${h.title}  ${h.tags.join(',')}\n${' '.repeat(16)}${kills}`,
  )
}
