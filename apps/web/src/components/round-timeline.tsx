import { OVERTIME_ROUNDS, REGULATION_ROUNDS, ROUNDS_PER_HALF, type Side } from '@subtick/domain'
import { Timer } from 'lucide-react'
import { Fragment, memo, useState } from 'react'
import { KillfeedDialog } from '@/components/killfeed-dialog'
import { KillfeedIcon } from '@/components/killfeed-icon'
import { ScrollTable } from '@/components/scoreboard/cells'
import { Tooltip } from '@/components/ui/tooltip'
import { SKULL_ICON, roundOutcome } from '@/lib/killfeed'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'

type Round = MatchDetail['rounds'][number]

/** First round of the second half and of every overtime half. */
const startsHalf = (n: number) =>
  n === ROUNDS_PER_HALF + 1 ||
  (n > REGULATION_ROUNDS && (n - REGULATION_ROUNDS - 1) % (OVERTIME_ROUNDS / 2) === 0)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * CS2's round history: each round's outcome sits above the line when the viewer's team won it
 * (the team that started CT when there's no viewer) and below when it lost, in the color of the
 * side that won. The viewer's kills stack up on top, and a round opens its killfeed.
 */
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
  const [open, setOpen] = useState(false)
  // Kept after closing so the dialog still has its content while it animates out.
  const [picked, setPicked] = useState<Round | null>(null)

  const selected = picked ?? data.rounds[0]
  const top = viewerTeam ?? 'CT'
  const viewer = data.players.find((p) => p.steamId === viewerSteamId)
  const killsByRound = new Map<number, number>()
  for (const k of data.kills) {
    if (k.attackerSteamId === viewerSteamId)
      killsByRound.set(k.round, (killsByRound.get(k.round) ?? 0) + 1)
  }

  return (
    <section className="min-w-0">
      <h2 className="mb-4 font-serif text-heading tracking-tight">Rounds</h2>
      {/* The scoreboard's scroller: edge to edge on phones, the strip inset to line up with the page. */}
      <div className="-my-2">
        <ScrollTable>
          <div className="flex w-max px-(--bleed)">
            {data.rounds.map((r) => {
              const { icon, label } = roundOutcome(r)
              const kills = killsByRound.get(r.number) ?? 0
              const color = r.winner === 'CT' ? 'text-side-ct' : 'text-side-t-text'

              return (
                <Fragment key={r.number}>
                  {startsHalf(r.number) && <div aria-hidden className="mx-2 w-px bg-border" />}
                  <Tooltip
                    content={`Round ${r.number}: ${r.winner} won by ${label}${viewerSteamId ? `. ${plural(kills, 'kill')}` : ''}`}
                    trigger={
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(r)
                          setOpen(true)
                        }}
                        className="relative grid w-7 cursor-pointer py-2 grid-rows-[auto_1.75rem_1.75rem_1rem] justify-items-center rounded-md outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        {viewerSteamId && (
                          <div
                            className={cn(
                              'flex h-18 flex-col-reverse items-center gap-0.5 pb-1',
                              kills >= 5
                                ? 'text-brand'
                                : kills >= 3
                                  ? 'text-foreground'
                                  : 'text-muted',
                            )}
                          >
                            {Array.from({ length: Math.min(kills, 5) }, (_, i) => (
                              <KillfeedIcon key={i} src={SKULL_ICON} className="size-3" />
                            ))}
                          </div>
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-x-0 h-px bg-border',
                            viewerSteamId ? 'top-[calc(0.5rem+4.5rem+1.75rem)]' : 'top-9',
                          )}
                        />
                        {r.winnerTeam && (
                          <span
                            className={cn(
                              'grid place-items-center self-center',
                              r.winnerTeam === top ? 'row-start-2' : 'row-start-3',
                              color,
                            )}
                          >
                            {icon ? (
                              <KillfeedIcon src={icon} className="size-4" />
                            ) : (
                              <Timer className="size-4" aria-hidden />
                            )}
                          </span>
                        )}
                        {(r.number === 1 || r.number % 5 === 0) && (
                          <span className="row-start-4 text-micro text-muted tabular-nums">
                            {r.number}
                          </span>
                        )}
                      </button>
                    }
                  />
                </Fragment>
              )
            })}
          </div>
        </ScrollTable>
      </div>
      {/* Mounted up front: a dialog mounted already open skips its enter animation. */}
      {selected && (
        <KillfeedDialog
          open={open}
          onOpenChange={setOpen}
          match={data}
          moment={{
            title: `Round ${selected.number}`,
            steamId: viewer?.steamId,
            round: selected.number,
            startTick: selected.freezeEndTick,
            endTick: selected.endTick,
            segments: [],
          }}
          player={viewer}
          roundEvents
          subtitle={`${selected.winner} won by ${roundOutcome(selected).label}`}
        />
      )}
    </section>
  )
})
