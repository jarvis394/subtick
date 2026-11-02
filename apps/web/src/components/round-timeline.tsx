import { ROUNDS_PER_HALF, type Side } from '@subtick/domain'
import { memo } from 'react'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

/** One cell per round: who won it (from the viewer's side), and how many kills they got. */
export const RoundTimeline = memo(function RoundTimeline({
  data,
  viewerSteamId,
  viewerTeam,
}: {
  data: MatchDetail
  viewerSteamId?: string
  /** The side the viewer's team started on. */
  viewerTeam?: Side
}) {
  const killsByRound = new Map<number, number>()
  for (const k of data.kills) {
    if (k.attackerSteamId === viewerSteamId)
      killsByRound.set(k.round, (killsByRound.get(k.round) ?? 0) + 1)
  }

  return (
    <section>
      <h2 className="mb-4 font-serif text-heading tracking-tight">Rounds</h2>
      <div className="flex flex-wrap gap-1">
        {data.rounds.map((r) => {
          const won = viewerTeam && r.winnerTeam ? r.winnerTeam === viewerTeam : undefined
          const kills = killsByRound.get(r.number) ?? 0

          return (
            <Tooltip
              key={r.number}
              content={`Round ${r.number}: ${r.winner} won (${r.reason.replaceAll('_', ' ')})`}
              trigger={
                <div
                  className={cn(
                    'grid w-8 gap-1 text-center',
                    r.number === ROUNDS_PER_HALF + 1 && 'ml-3',
                  )}
                >
                  <div
                    className={cn(
                      'h-8 rounded-md',
                      won === undefined
                        ? r.winner === 'CT'
                          ? 'bg-side-ct/70'
                          : 'bg-side-t/70'
                        : won
                          ? 'bg-success/80'
                          : 'bg-surface-3',
                    )}
                  />
                  <span
                    className={cn(
                      'text-caption tabular-nums',
                      kills >= 3 ? 'font-semibold text-foreground' : 'text-muted',
                    )}
                  >
                    {kills > 0 ? `${kills}k` : '·'}
                  </span>
                </div>
              }
            />
          )
        })}
      </div>
    </section>
  )
})
