import { and, eq, inArray, schema } from '@subtick/db'
import type { Context } from '../context'
import { type Actor, jobMatchId } from './matches'
import { getProfiles } from './profiles'

/** Pipeline stages in order; a match's row shows the furthest one it has work in. */
const STAGES = ['resolving', 'downloading', 'parsing', 'recording'] as const
export type QueueStage = (typeof STAGES)[number]

type JobState = 'active' | 'waiting' | 'delayed'
const STATE_ORDER: Record<JobState, number> = { active: 0, waiting: 1, delayed: 2 }

/** How many jobs each queue lists; plenty for a self-hosted instance. */
const LIMIT = 200

interface QueuedJob {
  stage: QueueStage
  state: JobState
  matchId: string
  progress: number | null
  highlightIds: string[]
  priority: number
  queuedAt: number
  startedAt: number | null
}

/** BullMQ stores whatever a worker reported; workers here report 0..1. */
const progressOf = (job: { progress: unknown }) =>
  typeof job.progress === 'number' && job.progress > 0 ? Math.min(job.progress, 1) : null

const readJobs = async ({ queues }: Pick<Context, 'queues'>): Promise<QueuedJob[]> => {
  const byStage = [
    ['resolving', queues.resolveMatch],
    ['downloading', queues.download],
    ['parsing', queues.parse],
    ['recording', queues.recordClip],
  ] as const
  const lists = await Promise.all(
    byStage.flatMap(([stage, queue]) =>
      (
        [
          ['active', ['active']],
          ['waiting', ['waiting', 'prioritized']],
          ['delayed', ['delayed']],
        ] as const
      ).map(async ([state, types]) =>
        (await queue.getJobs([...types], 0, LIMIT - 1)).flatMap((job): QueuedJob[] => {
          if (!job) return []
          const data = job.data as { matchId?: string; shareCode?: string; highlightIds?: string[] }
          const matchId = jobMatchId(data)
          if (!matchId) return []
          return [
            {
              stage,
              state,
              matchId,
              progress: state === 'active' ? progressOf(job) : null,
              highlightIds: data.highlightIds ?? [],
              priority: job.priority ?? 0,
              queuedAt: job.timestamp,
              startedAt: job.processedOn ?? null,
            },
          ]
        }),
      ),
    ),
  )
  return lists.flat()
}

/** A match's row: its furthest job, plus every clip its record jobs carry. */
interface MatchRow extends QueuedJob {
  /** Clips in any of the match's record jobs. */
  clipIds: Set<string>
  /** Clips in the record job a recorder is running now. */
  activeClipIds: Set<string>
}

/** What a clip in a recording match is doing. */
export type ClipState = 'recorded' | 'recording' | 'waiting' | 'failed'

/**
 * Every match with pipeline work waiting or running, across the instance: one row per match at
 * its furthest stage, running first, then in the order workers will pick them up. A match that
 * is recording lists its clips, so the page can show them being recorded one by one.
 */
export const listQueue = async (
  ctx: Pick<Context, 'db' | 'queues' | 'steamApi' | 'log'>,
  actor: Actor,
) => {
  const { db } = ctx
  const { match, userMatch, highlight, matchPlayer, user } = schema
  const jobs = await readJobs(ctx)

  const rows = new Map<string, MatchRow>()
  for (const job of jobs) {
    const current = rows.get(job.matchId)
    const furthest =
      !current ||
      STATE_ORDER[job.state] < STATE_ORDER[current.state] ||
      (job.state === current.state && STAGES.indexOf(job.stage) > STAGES.indexOf(current.stage))
    const row: MatchRow = furthest
      ? {
          ...job,
          clipIds: current?.clipIds ?? new Set(),
          activeClipIds: current?.activeClipIds ?? new Set(),
        }
      : current
    for (const id of job.highlightIds) row.clipIds.add(id)
    if (job.stage === 'recording' && job.state === 'active')
      for (const id of job.highlightIds) row.activeClipIds.add(id)
    rows.set(job.matchId, row)
  }

  const ids = [...rows.keys()]
  if (!ids.length) return { items: [] }
  const clipIds = [...rows.values()].flatMap((row) => [...row.clipIds])
  const [matches, mine, clips] = await Promise.all([
    db
      .select({
        id: match.id,
        map: match.map,
        status: match.status,
        playedAt: match.playedAt,
        createdAt: match.createdAt,
      })
      .from(match)
      .where(inArray(match.id, ids)),
    db
      .select({ matchId: userMatch.matchId })
      .from(userMatch)
      .where(and(eq(userMatch.userId, actor.id), inArray(userMatch.matchId, ids))),
    clipIds.length
      ? db
          .select({
            highlight,
            playerName: matchPlayer.name,
            requester: { id: user.id, name: user.name, image: user.image },
          })
          .from(highlight)
          .leftJoin(
            matchPlayer,
            and(
              eq(matchPlayer.matchId, highlight.matchId),
              eq(matchPlayer.steamId, highlight.steamId),
            ),
          )
          .leftJoin(user, eq(user.id, highlight.requestedBy))
          // Cancelled clips went back to candidates: they're no longer part of the queue.
          .where(
            and(
              inArray(highlight.id, clipIds),
              inArray(highlight.status, ['queued', 'recorded', 'failed']),
            ),
          )
          .orderBy(highlight.startTick)
      : [],
  ])
  const info = new Map(matches.map((m) => [m.id, m]))
  const own = new Set(mine.map((m) => m.matchId))
  const profiles = await getProfiles(
    ctx,
    clips.map((c) => c.highlight.steamId),
  )
  const clipsByMatch = Map.groupBy(clips, (c) => c.highlight.matchId)

  const items = [...rows.values()]
    .filter((row) => info.has(row.matchId))
    .toSorted(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        a.priority - b.priority ||
        a.queuedAt - b.queuedAt,
    )
    .map((row) => {
      const m = info.get(row.matchId)!
      const owns = own.has(row.matchId)
      const matchClips = clipsByMatch.get(row.matchId) ?? []
      // The recorder works through its batch in demo order: the first clip still queued is the
      // one being recorded now.
      const current = matchClips.find(
        (c) => c.highlight.status === 'queued' && row.activeClipIds.has(c.highlight.id),
      )?.highlight.id
      const stateOf = (h: (typeof matchClips)[number]['highlight']): ClipState =>
        h.status === 'recorded'
          ? 'recorded'
          : h.status === 'failed'
            ? 'failed'
            : h.id === current
              ? 'recording'
              : 'waiting'
      const moments = matchClips.map(({ highlight: h, playerName, requester }) => ({
        id: h.id,
        title: h.title,
        kind: h.kind,
        round: h.round,
        startTick: h.startTick,
        endTick: h.endTick,
        segments: h.segments,
        kills: h.kills.map((k) => ({ tags: k.tags })),
        clutch: h.clutch,
        state: stateOf(h),
        steamId: h.steamId,
        player: {
          name: playerName ?? 'Unknown',
          avatarUrl: profiles.get(h.steamId)?.avatarUrl ?? null,
        },
        /** Who asked for it; null when subtick queued it itself. */
        requester: requester?.id
          ? {
              id: requester.id,
              name: requester.name,
              image: requester.image ?? null,
              isViewer: requester.id === actor.id,
            }
          : null,
        /** Mirrors the cancel endpoint's rule. */
        canCancel:
          h.status === 'queued' &&
          (actor.isAdmin || h.requestedBy === actor.id || (h.requestedBy === null && owns)),
      }))
      return {
        matchId: row.matchId,
        map: m.map,
        playedAt: m.playedAt ?? m.createdAt,
        status: m.status,
        stage: row.stage,
        state: row.state,
        /** 0..1 while running, when the stage reports it. */
        progress: row.progress,
        /** Clips left to record, for the recording stage. */
        clips:
          row.stage === 'recording'
            ? moments.filter((c) => c.state === 'waiting' || c.state === 'recording').length
            : 0,
        moments,
        queuedAt: new Date(row.queuedAt),
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
        /** The viewer has this match. */
        mine: owns,
        /** The viewer may cancel something here: its stages, or clips they may cancel. */
        canCancel: actor.isAdmin || owns || moments.some((c) => c.canCancel),
      }
    })
  return { items }
}
