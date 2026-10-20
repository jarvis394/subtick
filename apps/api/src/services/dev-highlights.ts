import { type Db, and, asc, desc, eq, like, schema } from '@subtick/db'
import type { HighlightKill, KillTag } from '@subtick/domain'
import type { ClipProgress, MatchEvent } from '@subtick/queue'

/** Fake highlights are told apart by this title prefix, so only they can be listed or deleted. */
const PREFIX = '[dev] '

export const FAKE_STATES = ['failed', 'recording', 'ready'] as const
export type FakeState = (typeof FAKE_STATES)[number]

const STATE_LABEL: Record<FakeState, string> = {
  failed: 'failed',
  recording: 'recording',
  ready: 'ready',
}

const FAILURE =
  'The recording stalled: CS2 stopped answering while loading the demo (dev tools fake)'

const TAGS: KillTag[][] = [['headshot'], ['smoke'], [], ['headshot', 'wallbang']]

/** The fakes dev tools made on a match, newest first. */
export const listFakeHighlights = (db: Db, matchId: string) =>
  db
    .select({
      id: schema.highlight.id,
      title: schema.highlight.title,
      status: schema.highlight.status,
    })
    .from(schema.highlight)
    .where(and(eq(schema.highlight.matchId, matchId), like(schema.highlight.title, `${PREFIX}%`)))
    .orderBy(desc(schema.highlight.createdAt))

/**
 * Adds a fake highlight to a match: failed, waiting on the recorder ("recording"), or recorded.
 * It sits on the viewer's first two kills where the match has them, so its killfeed has content.
 * A recorded one borrows the video of any clip already stored, since there's nothing to record.
 */
export const addFakeHighlight = async (
  db: Db,
  userId: string,
  matchId: string,
  state: FakeState,
) => {
  const [owned] = await db
    .select({ steamId: schema.userMatch.steamId })
    .from(schema.userMatch)
    .where(and(eq(schema.userMatch.userId, userId), eq(schema.userMatch.matchId, matchId)))
  const steamId =
    owned?.steamId ??
    (
      await db
        .select({ steamId: schema.matchPlayer.steamId })
        .from(schema.matchPlayer)
        .where(eq(schema.matchPlayer.matchId, matchId))
        .limit(1)
    )[0]?.steamId
  if (!steamId) return { error: 'no_player' as const }

  const borrowed = state === 'ready' ? (await db.select().from(schema.clip).limit(1))[0] : undefined
  if (state === 'ready' && !borrowed) return { error: 'no_clip_to_borrow' as const }

  const mine = await db
    .select()
    .from(schema.kill)
    .where(and(eq(schema.kill.matchId, matchId), eq(schema.kill.attackerSteamId, steamId)))
    .orderBy(asc(schema.kill.tick))
    .limit(2)
  const [firstRound] = await db
    .select()
    .from(schema.round)
    .where(eq(schema.round.matchId, matchId))
    .orderBy(asc(schema.round.number))
    .limit(1)

  // Two kills: the page hides one-kill moments (they are never real highlights).
  const base = mine[0]?.tick ?? (firstRound ? firstRound.freezeEndTick + 640 : 1000)
  const kills: HighlightKill[] = [0, 1].map((i) => {
    const kill = mine[i]
    return {
      tick: kill?.tick ?? base + 128 * i,
      victimSteamId: kill?.victimSteamId ?? `dev${i}`,
      victimName: 'Dev victim',
      weapon: kill?.weapon ?? 'ak47',
      tags: TAGS[Math.floor(Math.random() * TAGS.length)]!,
    }
  })
  const startTick = Math.max(kills[0]!.tick - 192, firstRound?.freezeEndTick ?? 0)
  const endTick = kills[1]!.tick + 192

  const [highlight] = await db
    .insert(schema.highlight)
    .values({
      matchId,
      steamId,
      round: mine[0]?.round ?? firstRound?.number ?? 1,
      kind: 'double',
      title: `${PREFIX}Double kill (${STATE_LABEL[state]})`,
      score: 22,
      startTick,
      endTick,
      segments: [{ startTick, endTick }],
      kills,
      status: state === 'ready' ? 'recorded' : state === 'failed' ? 'failed' : 'queued',
      requestedBy: userId,
      error: state === 'failed' ? FAILURE : null,
    })
    .returning({ id: schema.highlight.id })
  if (borrowed) {
    await db.insert(schema.clip).values({ ...borrowed, highlightId: highlight!.id })
  }
  return { id: highlight!.id }
}

/** Deletes one of dev tools' fakes (its clip row goes with it; the borrowed video stays). */
export const deleteFakeHighlight = async (db: Db, id: string) => {
  const deleted = await db
    .delete(schema.highlight)
    .where(and(eq(schema.highlight.id, id), like(schema.highlight.title, `${PREFIX}%`)))
    .returning({ id: schema.highlight.id })
  return deleted.length > 0
}

const SIMULATED_SECONDS = 10

/** Runs in flight, standing in for a recorder's active job so the Queue lists them too. */
export const simulatedJobs = new Map<
  string,
  { matchId: string; queuedAt: number; progress: number; clip: ClipProgress }
>()

/**
 * Queues a fake highlight and plays a recorder's run over `SIMULATED_SECONDS`: loading, capturing
 * with progress, encoding, then the clip lands (borrowing a stored video) and the highlight is
 * recorded. Deleting the fake midway just stops the run.
 */
export const simulateRecording = async (
  db: Db,
  publish: (event: MatchEvent) => unknown,
  userId: string,
  matchId: string,
) => {
  const added = await addFakeHighlight(db, userId, matchId, 'recording')
  if ('error' in added) return added
  const { id } = added
  simulatedJobs.set(id, {
    matchId,
    queuedAt: Date.now(),
    progress: 0,
    clip: { id, phase: 'loading' },
  })

  void (async () => {
    try {
      await run()
    } finally {
      simulatedJobs.delete(id)
    }
  })()

  async function run() {
    for (let second = 0; second < SIMULATED_SECONDS; second++) {
      // oxlint-disable-next-line no-await-in-loop -- one tick per second, in order
      const [still] = await db
        .select({ id: schema.highlight.id })
        .from(schema.highlight)
        .where(and(eq(schema.highlight.id, id), eq(schema.highlight.status, 'queued')))
      if (!still) return
      const progress = second / SIMULATED_SECONDS
      const clip: ClipProgress =
        second === 0
          ? { id, phase: 'loading' }
          : second >= SIMULATED_SECONDS - 1
            ? { id, phase: 'rendering' }
            : { id, phase: 'recording', progress: (second - 1) / (SIMULATED_SECONDS - 3) }
      simulatedJobs.set(id, { matchId, queuedAt: simulatedJobs.get(id)!.queuedAt, progress, clip })
      void publish({ matchId, status: 'recording', progress, clip })
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const [borrowed] = await db.select().from(schema.clip).limit(1)
    const [done] = borrowed
      ? await db
          .update(schema.highlight)
          .set({ status: 'recorded' })
          .where(and(eq(schema.highlight.id, id), eq(schema.highlight.status, 'queued')))
          .returning({ id: schema.highlight.id })
      : []
    if (done && borrowed) await db.insert(schema.clip).values({ ...borrowed, highlightId: id })
    simulatedJobs.delete(id)
    void publish({ matchId, status: 'ready' })
  }
  return added
}
