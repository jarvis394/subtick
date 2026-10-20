import { Link } from '@tanstack/react-router'
import { Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'

const GRID =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_4rem] items-center gap-x-3 px-4 md:grid-cols-[minmax(0,1fr)_5rem_6rem_6rem_6rem] md:px-5'
const WIDE = 'hidden md:block'

const tone = (rating: number) =>
  rating >= 1.15 ? 'text-success' : rating < 0.85 ? 'text-danger' : undefined

export const TeammatesTab = ({ player }: { player: Player }) => {
  if (!player.teammates.length)
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted">
        <Users className="mx-auto mb-2 size-5" />
        Players who queue with {player.isMe ? 'you' : player.name} more than once show up here.
      </p>
    )

  return (
    <div className="-mx-4 overflow-hidden border-y bg-surface md:mx-0 md:rounded-2xl md:border-x">
      <div className={cn(GRID, 'h-10 border-b text-[12px] font-medium text-muted')}>
        <span>Player</span>
        <span className="text-right">Matches</span>
        <span className="text-right">Win rate</span>
        <span className={cn(WIDE, 'text-right')}>Their rating</span>
        <span className={cn(WIDE, 'text-right')}>{player.isMe ? 'Your rating' : 'Rating'}</span>
      </div>
      {player.teammates.map((t) => (
        <Link
          key={t.steamId}
          to="/players/$steamId"
          params={{ steamId: t.steamId }}
          className={cn(
            GRID,
            'h-14 border-b text-sm tabular-nums outline-none last:border-0',
            'hover:bg-surface-2/60 focus-visible:bg-surface-2/60',
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Avatar src={t.avatarUrl} name={t.name} className="size-8" />
            <span className="truncate font-medium">{t.name}</span>
          </span>
          <span className="text-right">{t.matches}</span>
          <span
            className={cn(
              'text-right',
              t.winRate !== null &&
                (t.winRate >= 55 ? 'text-success' : t.winRate < 45 && 'text-danger'),
            )}
          >
            {t.winRate === null ? '–' : `${t.winRate}%`}
          </span>
          <span className={cn(WIDE, 'text-right font-medium', tone(t.theirRating))}>
            {t.theirRating.toFixed(2)}
          </span>
          <span className={cn(WIDE, 'text-right font-medium', tone(t.ownRating))}>
            {t.ownRating.toFixed(2)}
          </span>
        </Link>
      ))}
    </div>
  )
}
