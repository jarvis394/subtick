import { summarize } from '@subtick/domain'
import { motion, type Transition, useIsPresent } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Played } from './facts'
import type { Slot } from './session-layout'

const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

/** A darker left edge shades the session labels into the chart's background. */
const SESSION_LABEL_BG =
  'linear-gradient(to right, color-mix(in oklab, var(--color-background) 85%, black), var(--color-background))'

export const sessionKey = (session: Played[]) => session[0]!.matchId

export const sessionDay = (session: Played[]) => DAY.format(new Date(session.at(-1)!.playedAt))

/** The side that leads takes its color; level stays neutral. */
export const WinLoss = ({ wins, losses }: { wins: number; losses: number }) => (
  <>
    <span className={cn(wins > losses && 'text-success')}>{wins}W</span>
    {' / '}
    <span className={cn(losses > wins && 'text-danger')}>{losses}L</span>
  </>
)

/** What leaving tracks read from AnimatePresence, because they no longer receive new props. */
export type Departure = { away: Record<string, Slot>; transition: Transition }

/**
 * A row's item, stacked in one grid cell and placed by real `left` and `width`. Scale would stretch
 * corners and text, and a transform would throw off the sticky labels inside, which ignore it.
 */
export const Track = ({
  id,
  slot,
  transition,
  departure,
  decorative,
  className,
  children,
}: {
  id: string
  slot: Slot
  transition: Transition
  departure: Departure
  decorative?: boolean
  className?: string
  children: ReactNode
}) => {
  const present = useIsPresent()

  return (
    <motion.li
      aria-hidden={decorative}
      inert={!present}
      className={cn('relative justify-self-start', !present && 'pointer-events-none', className)}
      custom={departure}
      variants={{
        away: ({ away, transition: leaving }: Departure) => ({
          ...away[id],
          opacity: 0,
          transition: leaving,
        }),
      }}
      initial="away"
      animate={{ ...slot, opacity: 1, transition }}
      exit="away"
    >
      {children}
    </motion.li>
  )
}

export const SessionLabel = ({
  matches,
  open,
  onToggle,
}: {
  matches: Played[]
  open: boolean
  onToggle?: () => void
}) => {
  const { wins, losses } = summarize(matches)
  // A shorter session's label fills its block, leaving nothing to travel.
  const sticks = matches.length > 2

  // Overlaid, each inset by the other's width plus 16px: sticky stops at its parent's padding, so
  // the labels push each other instead of colliding.
  return (
    <Button
      size="xs"
      variant="recessed"
      aria-pressed={onToggle ? open : undefined}
      onClick={onToggle}
      className={cn(
        // The pseudo-element takes the hit area to 32px, past the 28px it draws.
        '-mx-1 w-[calc(100%+0.5rem)] text-left text-micro font-normal after:absolute after:-inset-y-0.5 after:inset-x-0',
        matches.length > 1 ? 'px-2.5' : 'px-1.5',
      )}
      // The layer stays clear at rest so the gradient shows; hover still fills it.
      style={{ backgroundImage: SESSION_LABEL_BG, '--bg': 'transparent' } as CSSProperties}
    >
      <span className="grid w-full *:col-start-1 *:row-start-1">
        <span className={cn(sticks && 'pr-16', matches.length === 1 && 'text-center')}>
          <span className={cn('inline-block', sticks && 'sticky left-5.5')}>
            {sessionDay(matches)}
          </span>
        </span>
        {matches.length > 1 && (
          <span className={cn('text-right tabular-nums', sticks && 'pl-14')}>
            <span className={cn('inline-block', sticks && 'sticky right-5.5')}>
              <WinLoss wins={wins} losses={losses} />
            </span>
          </span>
        )}
      </span>
    </Button>
  )
}
