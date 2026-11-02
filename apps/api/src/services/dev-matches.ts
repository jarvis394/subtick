import { type Db, and, desc, eq, schema } from '@subtick/db'
import type { PlayerStats } from '@subtick/domain'

/** Dev tools: fake matches that a refresh "finds", for working on the new-match UI without a steam worker. */

const MAPS = [
  'de_ancient',
  'de_anubis',
  'de_dust2',
  'de_inferno',
  'de_mirage',
  'de_nuke',
  'de_train',
]

const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const pick = <T>(items: readonly T[]) => items[int(0, items.length - 1)]!

const randomStats = (roundsPlayed: number): PlayerStats => {
  const kills = int(5, 35)
  const deaths = int(8, 24)
  const assists = int(1, 10)
  const headshotKills = int(0, kills)
  const damage = kills * int(80, 110) + assists * 30
  const kastRounds = int(Math.floor(roundsPlayed * 0.5), roundsPlayed)
  const kpr = kills / roundsPlayed
  const survival = (roundsPlayed - deaths) / roundsPlayed

  return {
    kills,
    deaths,
    assists,
    flashAssists: int(0, 4),
    headshotKills,
    damage,
    utilityDamage: int(0, 300),
    roundsPlayed,
    kastRounds,
    openingKills: int(0, 6),
    openingDeaths: int(0, 6),
    tradeKills: int(0, 5),
    enemiesFlashed: int(0, 12),
    multiKills: [int(3, 10), int(0, 4), int(0, 2), int(0, 1), Math.random() < 0.1 ? 1 : 0],
    clutchesWon: int(0, 2),
    clutchesAttempted: int(0, 4),
    adr: Math.round(damage / roundsPlayed),
    hsPercent: kills ? Math.round((headshotKills / kills) * 100) : 0,
    kastPercent: Math.round((kastRounds / roundsPlayed) * 100),
    rating: Math.round(((kpr / 0.679 + (0.7 * survival) / 0.317 + 1) / 2.7) * 100) / 100,
  }
}

/** Marks the matches dev tools made, so only those can be listed and deleted. */
const DEV_SERVER = 'subtick dev'

type FakeMatch = ReturnType<typeof randomMatch>

/** Staged per user until their next refresh, like matches Steam has but subtick hasn't seen yet. */
const pending = new Map<string, FakeMatch[]>()

const randomMatch = () => {
  const loserScore = int(0, 11)
  const won = Math.random() < 0.5
  const ownScore = won ? 13 : loserScore
  const enemyScore = won ? loserScore : 13
  const before = int(8000, 22000)
  const change = won ? int(50, 450) : -int(50, 450)

  return {
    id: `9${String(Date.now())}${String(int(0, 99999)).padStart(5, '0')}`,
    map: pick(MAPS),
    startingSide: pick(['CT', 'T'] as const),
    ownScore,
    enemyScore,
    rank: { mode: 'premier' as const, before, after: before + change, change, wins: int(10, 200) },
    stats: randomStats(ownScore + enemyScore),
  }
}

/** What the dev menu shows for a fake match, staged or added. */
const card = (m: { id: string; map: string; ownScore: number; enemyScore: number }) => ({
  id: m.id,
  map: m.map,
  ownScore: m.ownScore,
  enemyScore: m.enemyScore,
})

export const stageFakeMatch = (userId: string) => {
  const fake = randomMatch()
  pending.set(userId, [...(pending.get(userId) ?? []), fake])

  return card(fake)
}

export const stagedFakeMatches = (userId: string) => pending.get(userId)?.length ?? 0

/** The user's fake matches: staged ones (newest first), then the ones a refresh added. */
export const listFakeMatches = async (db: Db, userId: string) => {
  const rows = await db
    .select({
      id: schema.match.id,
      map: schema.match.map,
      side: schema.matchPlayer.startingSide,
      ct: schema.match.scoreStartedCt,
      t: schema.match.scoreStartedT,
    })
    .from(schema.userMatch)
    .innerJoin(schema.match, eq(schema.match.id, schema.userMatch.matchId))
    .innerJoin(
      schema.matchPlayer,
      and(
        eq(schema.matchPlayer.matchId, schema.match.id),
        eq(schema.matchPlayer.steamId, schema.userMatch.steamId),
      ),
    )
    .where(and(eq(schema.userMatch.userId, userId), eq(schema.match.serverName, DEV_SERVER)))
    .orderBy(desc(schema.userMatch.discoveredAt))

  return {
    pending: (pending.get(userId) ?? []).map(card).toReversed(),
    added: rows.map((r) => {
      const [own, enemy] = r.side === 'CT' ? [r.ct, r.t] : [r.t, r.ct]

      return card({ id: r.id, map: r.map ?? '', ownScore: own ?? 0, enemyScore: enemy ?? 0 })
    }),
  }
}

/** Unstages a fake match, or deletes one a refresh added; real matches are never touched. */
export const deleteFakeMatch = async (db: Db, userId: string, id: string) => {
  const queue = pending.get(userId) ?? []
  if (queue.some((m) => m.id === id)) {
    pending.set(
      userId,
      queue.filter((m) => m.id !== id),
    )

    return true
  }
  const owned = await db
    .select({ id: schema.userMatch.matchId })
    .from(schema.userMatch)
    .where(and(eq(schema.userMatch.userId, userId), eq(schema.userMatch.matchId, id)))
  if (!owned.length) return false
  const deleted = await db
    .delete(schema.match)
    .where(and(eq(schema.match.id, id), eq(schema.match.serverName, DEV_SERVER)))
    .returning({ id: schema.match.id })

  return deleted.length > 0
}

/** Turns a user's staged fakes into ready matches on `steamId`; returns how many it added. */
export const materializeFakeMatches = async (db: Db, userId: string, steamId: string) => {
  const fakes = pending.get(userId) ?? []
  pending.delete(userId)
  for (const fake of fakes) {
    const { id, startingSide, ownScore, enemyScore } = fake
    // oxlint-disable-next-line no-await-in-loop -- a handful of rows, in order
    await db.transaction(async (tx) => {
      await tx.insert(schema.match).values({
        id,
        status: 'ready',
        map: fake.map,
        mode: 'premier',
        serverName: DEV_SERVER,
        roundsPlayed: ownScore + enemyScore,
        scoreStartedCt: startingSide === 'CT' ? ownScore : enemyScore,
        scoreStartedT: startingSide === 'T' ? ownScore : enemyScore,
        playedAt: new Date(Date.now() - int(10, 60) * 60_000),
      })
      await tx.insert(schema.matchPlayer).values({
        matchId: id,
        steamId,
        name: 'dev',
        startingSide,
        stats: fake.stats,
        rank: fake.rank,
      })
      await tx.insert(schema.userMatch).values({ userId, matchId: id, steamId })
    })
  }

  return fakes.length
}
