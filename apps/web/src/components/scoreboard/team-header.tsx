import type { Side } from '@subtick/domain'
import type { ReactNode } from 'react'
import { RankBadge } from '@/components/rank-badge'
import { Badge } from '@/components/ui/surface'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { type Player, averagePremier, halfScores, teamScore } from './columns'

export interface Team {
  side: Side
  players: Player[]
}

/**
 * A team's score line as a full-width table row. Its content stays put while the table scrolls
 * sideways and lines up with the page content, like the heading above the table.
 */
export const TeamHeaderRow = ({
  colSpan,
  first,
  children,
}: {
  colSpan: number
  first: boolean
  children: ReactNode
}) => (
  <tr>
    <td colSpan={colSpan} className="p-0">
      <div
        className={cn(
          'sticky left-(--e) w-[calc(100cqw-2*var(--e))] px-(--bleed) pb-2.5',
          !first && 'pt-8',
        )}
      >
        {children}
      </div>
    </td>
  </tr>
)

export const TeamSummary = ({
  data,
  team: { side, players },
  viewerTeam,
}: {
  data: MatchDetail
  team: Team
  viewerTeam: Side | undefined
}) => {
  const score = teamScore(data, side)
  const enemy = teamScore(data, side === 'CT' ? 'T' : 'CT')
  const halves = halfScores(data.rounds, side)
  const avg = averagePremier(players)
  const label = viewerTeam
    ? side === viewerTeam
      ? 'Your team'
      : 'Opponents'
    : `Team ${players[0]?.name ?? side}`

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body">
      <span
        className={cn(
          'font-mono text-section tabular-nums',
          score > enemy ? 'text-success' : score < enemy ? 'text-danger' : 'text-foreground',
        )}
      >
        {score}
      </span>
      <span className="font-medium">{label}</span>
      <Badge tone={side === 'CT' ? 'ct' : 't'}>Started {side}</Badge>
      <span className="ml-auto flex items-center gap-4 text-small text-muted">
        {avg !== null && (
          <span className="flex items-center gap-2">
            Team avg
            <RankBadge
              rank={{ mode: 'premier', before: avg, after: avg, change: 0, wins: 0 }}
              showChange={false}
            />
          </span>
        )}
        <span>
          First half <span className="font-medium text-foreground">{halves.first}</span>
        </span>
        <span>
          Second half <span className="font-medium text-foreground">{halves.second}</span>
        </span>
        {halves.overtime !== null && (
          <span>
            OT <span className="font-medium text-foreground">{halves.overtime}</span>
          </span>
        )}
      </span>
    </div>
  )
}
