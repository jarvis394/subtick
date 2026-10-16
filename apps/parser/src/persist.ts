import { type Db, eq, inArray, schema } from '@subtick/db'
import type { MatchAnalysis } from './analyze'

const { match, matchPlayer, round, kill, highlight, steamLink } = schema

/**
 * Replaces everything derived from the demo in one transaction (re-parsing is idempotent) and
 * returns the highlights that should be recorded now: those of players who use subtick.
 * Other players' highlights stay `candidate` and are recorded on request.
 */
export const persistAnalysis = async (
  db: Db,
  matchId: string,
  analysis: MatchAnalysis,
  parserVersion: number,
) => {
  const { timeline, stats, highlights, killTags, mode, ranks } = analysis
  const steamIds = [...timeline.players.keys()]

  return db.transaction(async (tx) => {
    const users = await tx
      .select({ steamId: steamLink.steamId })
      .from(steamLink)
      .where(inArray(steamLink.steamId, steamIds))
    const subtickPlayers = new Set(users.map((u) => u.steamId))

    await tx
      .update(match)
      .set({
        status: 'recording',
        error: null,
        map: timeline.header.map,
        mode,
        serverName: timeline.header.serverName,
        tickrate: timeline.tickrate,
        durationTicks: timeline.durationTicks,
        roundsPlayed: timeline.rounds.length,
        scoreStartedCt: timeline.finalScore.CT,
        scoreStartedT: timeline.finalScore.T,
        parserVersion,
      })
      .where(eq(match.id, matchId))

    const [{ parties } = { parties: null }] = await tx
      .select({ parties: match.parties })
      .from(match)
      .where(eq(match.id, matchId))

    await Promise.all(
      [matchPlayer, round, kill, highlight].map((table) =>
        tx.delete(table).where(eq(table.matchId, matchId)),
      ),
    )

    await tx.insert(matchPlayer).values(
      [...timeline.players.values()].map((p) => ({
        matchId,
        steamId: p.steamId,
        name: p.name,
        startingSide: p.startingSide,
        stats: stats.get(p.steamId)!,
        rank: ranks.get(p.steamId) ?? null,
        partyId: parties?.[p.steamId] ?? null,
      })),
    )

    await tx.insert(round).values(
      timeline.rounds.map((r) => {
        const equip = { CT: 0, T: 0 }
        for (const [id, side] of r.sides) equip[side] += r.equip.get(id) ?? 0
        return {
          matchId,
          number: r.number,
          winner: r.winner,
          winnerTeam: r.winnerTeam,
          reason: r.reason,
          startTick: r.startTick,
          freezeEndTick: r.freezeEndTick,
          endTick: r.endTick,
          ctEquipValue: equip.CT,
          tEquipValue: equip.T,
        }
      }),
    )

    if (timeline.kills.length) {
      await tx.insert(kill).values(
        timeline.kills.map((k) => ({
          matchId,
          round: k.round,
          tick: k.tick,
          attackerSteamId: k.attacker,
          victimSteamId: k.victim,
          assisterSteamId: k.assister,
          weapon: k.weapon,
          tags: killTags.get(k.id) ?? [],
          distance: k.distance,
        })),
      )
    }

    if (!highlights.length) return []
    const rows = await tx
      .insert(highlight)
      .values(
        highlights.map((h) => ({
          matchId,
          steamId: h.steamId,
          round: h.round,
          kind: h.kind,
          title: h.title,
          score: h.score,
          startTick: h.startTick,
          endTick: h.endTick,
          kills: h.kills,
          tags: h.tags,
          clutch: h.clutch,
          status: subtickPlayers.has(h.steamId) ? ('queued' as const) : ('candidate' as const),
        })),
      )
      .returning({ id: highlight.id, status: highlight.status })

    return rows.filter((r) => r.status === 'queued').map((r) => r.id)
  })
}

export const markMatchFailed = (db: Db, matchId: string, error: string) =>
  db.update(match).set({ status: 'failed', error }).where(eq(match.id, matchId))
