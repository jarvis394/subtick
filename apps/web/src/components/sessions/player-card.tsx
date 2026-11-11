import { Radio } from '@base-ui/react/radio'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { PlayerLink } from '@/components/player-link'
import { GeneratedBanner } from '@/components/profile/generated-banner'
import { WinLoss } from '@/components/profile/session-track'
import { RankBadge } from '@/components/rank-badge'
import { Avatar } from '@/components/ui/avatar'
import { FadeImage } from '@/components/ui/fade-image'
import type { Session, SessionPlayer } from '@/lib/queries'
import { cn } from '@/lib/utils'

/**
 * Bar ends: a value past them fills the bar, so one huge game never flattens the rest. `good` and
 * `bad` grade the value on its own, the same cutoffs as the profile's rating tone.
 */
const METRICS = [
  { id: 'rating', label: 'Rating', max: 2, digits: 2, good: 1.15, bad: 0.85 },
  { id: 'kd', label: 'K/D', max: 2, digits: 2, good: 1.15, bad: 0.85 },
  { id: 'adr', label: 'ADR', max: 150, digits: 0, good: 85, bad: 65 },
] as const

const RankMove = ({ change }: { change: number }) =>
  change > 0 ? (
    <ChevronUp
      aria-label={`Up ${change} this session`}
      className="-mx-1 size-4 shrink-0 text-success"
    />
  ) : change < 0 ? (
    <ChevronDown
      aria-label={`Down ${-change} this session`}
      className="-mx-1 size-4 shrink-0 text-danger"
    />
  ) : null

const share = (value: number, max: number) => `${Math.min(value / max, 1) * 100}%`

const TOP = 'absolute inset-x-0 top-0 bottom-1/2 mb-px rounded-[2px]'
const BOTTOM = 'absolute inset-x-0 top-1/2 bottom-0 mt-px rounded-[2px]'
const EMPTY = 'bg-foreground/10'

/** Empty slots past the last match, fading out toward the card's edge. */
const FILLER = 32

/**
 * A two-row grid, oldest match first: a win fills the top slot, a loss the bottom one and a draw
 * sits across both, so they read apart without color; a line holds a missed match.
 */
const SessionForm = ({ session, player }: { session: Session; player: SessionPlayer }) => {
  const played = new Map(player.played.map((p) => [p.matchId, p]))
  const missed = session.matches.length - player.matches

  return (
    <span
      role="img"
      aria-label={[
        `${player.wins} won`,
        `${player.losses} lost`,
        missed > 0 && `${missed} not played`,
      ]
        .filter(Boolean)
        .join(', ')}
      className="flex h-6 min-w-0 flex-1 gap-0.5 overflow-hidden"
    >
      {session.matches.toReversed().map((m) => {
        const result = played.get(m.id)?.result

        return (
          <span key={m.id} className="relative w-3 shrink-0">
            {!played.has(m.id) ? (
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/20" />
            ) : result === 'draw' ? (
              <span className="absolute inset-x-0 inset-y-1/4 rounded-[2px] bg-muted" />
            ) : (
              <>
                <span className={cn(TOP, result === 'win' ? 'bg-success' : EMPTY)} />
                <span className={cn(BOTTOM, result === 'loss' ? 'bg-danger' : EMPTY)} />
              </>
            )}
          </span>
        )
      })}
      <span
        aria-hidden
        className="flex min-w-0 flex-1 gap-0.5 overflow-hidden [mask-image:linear-gradient(to_right,black,transparent)]"
      >
        {Array.from({ length: FILLER }, (_, i) => (
          <span key={i} className="relative w-3 shrink-0">
            <span className={cn(TOP, EMPTY)} />
            <span className={cn(BOTTOM, EMPTY)} />
          </span>
        ))}
      </span>
    </span>
  )
}

const Metric = ({
  label,
  value,
  usual,
  max,
  digits,
  good,
  bad,
}: {
  label: string
  value: number
  usual: number | null
  max: number
  digits: number
  good: number
  bad: number
}) => {
  const delta = usual === null ? 0 : Number((value - usual).toFixed(digits))

  return (
    <span className="grid grid-cols-[1fr_auto] items-baseline gap-x-2">
      <span className="text-caption text-muted">{label}</span>
      <span className="flex items-center gap-1 text-small font-medium tabular-nums">
        {value.toFixed(digits)}
        {usual !== null && <span className="sr-only">, usually {usual.toFixed(digits)}</span>}
        {delta > 0 ? (
          <ArrowUp aria-hidden className="size-3 text-success" />
        ) : delta < 0 ? (
          <ArrowDown aria-hidden className="size-3 text-danger" />
        ) : (
          <span aria-hidden className="w-3" />
        )}
      </span>
      <span
        aria-hidden
        className="relative col-span-2 mt-1.5 mb-1 h-1 rounded-full bg-foreground/10"
      >
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            value >= good ? 'bg-success' : value < bad ? 'bg-danger' : 'bg-foreground/45',
          )}
          style={{ width: share(value, max) }}
        />
        {usual !== null && (
          <span
            className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: share(usual, max) }}
          />
        )}
      </span>
    </span>
  )
}

/**
 * The top opens the player's profile; the rest picks them as the session's point of view, its bars
 * set against their usual level going in (the tick).
 */
export const PlayerCard = ({ session, player }: { session: Session; player: SessionPlayer }) => {
  return (
    <div
      className={cn(
        'group/card relative isolate flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl outline outline-border lg:w-auto lg:max-w-80 lg:min-w-52 lg:flex-1',
        'transition-colors duration-150 motion-reduce:transition-none',
        '[--bg-hover:var(--color-surface-2)] [--bg:var(--color-surface)]',
        'has-data-checked:outline-transparent has-data-checked:[--bg-hover:var(--color-surface-3)] has-data-checked:[--bg:var(--color-surface-2)]',
      )}
    >
      {/* Button's fill layer, by hand: a card holding a link and a radio can't be one button. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 rounded-2xl bg-(--bg)',
          '[transition:inset_160ms_var(--ease-out-quart),border-radius_160ms_var(--ease-out-quart),background-color_150ms_ease]',
          'group-hover/card:bg-(--bg-hover) group-active/card:inset-px group-active/card:rounded-[calc(var(--radius-2xl)-1px)]',
          'pointer-coarse:group-active/card:bg-(--bg-hover)',
          'motion-reduce:group-active/card:inset-0 motion-reduce:group-active/card:rounded-2xl',
        )}
      />
      <PlayerLink
        steamId={player.steamId}
        vanity={player.vanity}
        className="group/link relative block rounded-none rounded-t-[inherit] focus-visible:ring-inset"
      >
        <span className="relative block aspect-[3/1] overflow-hidden bg-surface-2">
          {player.bannerUrl ? (
            <FadeImage src={player.bannerUrl} alt="" className="size-full object-cover" />
          ) : (
            <GeneratedBanner seed={player.steamId} className="size-full" />
          )}
        </span>
        <span className="relative -mt-10.5 flex items-end gap-2 px-3">
          <Avatar
            src={player.avatarUrl}
            name={player.name}
            className="size-14 ring-4 ring-(--bg) [transition:box-shadow_150ms_ease] group-hover/card:ring-(--bg-hover)"
          />
        </span>
        <span className="mt-2 flex items-center gap-2 px-3 text-body font-medium">
          {player.rank && (
            <>
              <RankBadge rank={player.rank} showChange={false} />
              <RankMove change={player.rank.change} />
            </>
          )}
          <span className="truncate">{player.name}</span>
          <ChevronRight
            aria-hidden
            strokeWidth={2.5}
            className="ml-auto size-4 shrink-0 text-muted transition-transform duration-150 group-hover/link:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-foreground/5 to-transparent opacity-0 transition-opacity duration-150 group-hover/link:opacity-100 group-active/link:from-foreground/10 group-active/link:opacity-100 motion-reduce:transition-none"
        />
      </PlayerLink>

      <Radio.Root
        value={player.steamId}
        aria-label={`See the session as ${player.name}`}
        className={cn(
          'flex flex-1 cursor-pointer flex-col gap-3 rounded-b-[inherit] px-3 pt-2 pb-3 text-left outline-none select-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <span className="relative flex h-6 items-center gap-3">
          <SessionForm session={session} player={player} />
          <span className="shrink-0 text-caption text-muted tabular-nums">
            <WinLoss wins={player.wins} losses={player.losses} />
          </span>
        </span>
        <span className="grid gap-2">
          {METRICS.map((m) => (
            <Metric
              key={m.id}
              label={m.label}
              value={player[m.id]}
              usual={player.usual?.[m.id] ?? null}
              max={m.max}
              digits={m.digits}
              good={m.good}
              bad={m.bad}
            />
          ))}
        </span>
      </Radio.Root>
    </div>
  )
}
