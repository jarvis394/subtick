import { type MatchMode, decodeCrosshair, mapName, standingRank } from '@subtick/domain'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { RankBadge } from '@/components/rank-badge'
import { SteamIcon } from '@/components/steam-icon'
import { Button, IconButton } from '@/components/ui/button'
import { MorphLabel } from '@/components/ui/morph-label'
import { Card } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/format'
import { useCopied } from '@/lib/use-copied'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CardHeader } from './card-header'
import { CrosshairPreview } from './crosshair-preview'
import { RankProgressChart } from './rank-progress'

const RailCard = ({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) => (
  <Card bleed className={cn('p-4 pt-3', className)}>
    <CardHeader title={title} action={action} />
    {children}
  </Card>
)

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

const SteamCard = ({ player, className }: { player: Player; className?: string }) => {
  const url = `https://steamcommunity.com/profiles/${player.steamId}`

  return (
    <RailCard
      title="Steam"
      className={className}
      action={
        <Button
          size="xs"
          variant="ghost"
          render={<a href={url} target="_blank" rel="noreferrer" />}
        >
          Profile <ExternalLink />
        </Button>
      }
    >
      <Button
        variant="ghost"
        render={<a href={url} target="_blank" rel="noreferrer" />}
        className="-mx-2 -mt-1.5 h-auto w-[calc(100%+1rem)] justify-start gap-3 px-2 py-1.5 text-left font-normal [&_svg]:size-4.5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-foreground">
          <SteamIcon />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-body font-medium text-foreground">
            {player.personaName ?? player.name}
          </span>
          <span className="block font-mono text-label text-muted">{player.steamId}</span>
        </span>
      </Button>
      <dl className="-mx-4 mt-1.5 -mb-4 grid grid-cols-2 border-t text-body">
        <div className="min-w-0 px-4 py-3">
          <dt className="text-label text-muted">Last match</dt>
          <dd className="mt-0.5">{player.lastMatchAt ? timeAgo(player.lastMatchAt) : '–'}</dd>
        </div>
        <div className="min-w-0 px-4 py-3">
          <dt className="text-label text-muted">On subtick</dt>
          <dd className="mt-0.5">
            {player.memberSince
              ? `Since ${MONTH_YEAR.format(new Date(player.memberSince))}`
              : 'Not yet'}
          </dd>
        </div>
      </dl>
    </RailCard>
  )
}

const HighRank = ({
  label,
  mode,
  value,
  map,
}: {
  label: string
  mode: MatchMode
  value: number
  map?: string | null
}) => (
  <div className="min-w-0">
    <dt className="truncate text-caption text-muted">{label}</dt>
    <dd className="mt-1 flex items-center gap-2">
      <RankBadge rank={standingRank(mode, value)} showChange={false} />
      {map !== undefined && (
        <span className="min-w-0 truncate text-caption text-muted">{mapName(map)}</span>
      )}
    </dd>
  </div>
)

/** The highest ranks over the line that got there. */
const RanksCard = ({ player, className }: { player: Player; className?: string }) => {
  const { premier, competitive, wingman } = player.ranks
  if (!premier && !competitive && !wingman) return null

  return (
    <Card bleed className={className}>
      <div className="p-4 pt-3">
        <CardHeader title="Highest ranks" />
        <dl className="flex flex-wrap gap-x-6 gap-y-3">
          {premier && <HighRank label="Premier" mode="premier" value={premier.best} />}
          {competitive && (
            <HighRank
              label="Competitive"
              mode="competitive"
              value={competitive.best}
              map={competitive.bestMap}
            />
          )}
          {wingman && (
            <HighRank label="Wingman" mode="wingman" value={wingman.best} map={wingman.bestMap} />
          )}
        </dl>
      </div>
      <div className="border-t p-4">
        <RankProgressChart history={player.history} />
      </div>
    </Card>
  )
}

const CopyMark = ({ copied }: { copied: boolean }) => (
  // Both icons stacked, crossfading like the label beside them.
  <span className="grid place-items-center *:col-start-1 *:row-start-1">
    <Copy
      className={cn(
        'transition-[opacity,scale] duration-150 ease-out',
        copied && 'scale-75 opacity-0',
      )}
    />
    <Check
      className={cn(
        'text-success transition-[opacity,scale] duration-150 ease-out',
        !copied && 'scale-75 opacity-0',
      )}
    />
  </span>
)

const CrosshairTile = ({ code, large }: { code: string; large?: boolean }) => {
  const { copied, copy } = useCopied()
  const crosshair = decodeCrosshair(code)
  if (!crosshair) return null

  return (
    // Dark in both themes, so any crosshair color reads against it, as it would in game.
    <span className="theme-dark contents">
      <IconButton
        variant="secondary"
        size="lg"
        label={copied ? 'Copied' : 'Copy this crosshair'}
        onClick={() => copy(code)}
        className={cn('[&_svg]:size-full', large && 'size-14')}
      >
        <CrosshairPreview
          crosshair={crosshair}
          className={cn('transition-opacity duration-150', copied && 'opacity-0')}
        />
        <Check
          aria-hidden
          className={cn(
            'absolute size-4! text-foreground transition-[opacity,scale] duration-150 ease-out',
            !copied && 'scale-75 opacity-0',
          )}
        />
      </IconButton>
    </span>
  )
}

/** The current crosshair, then a divider, then the ones used before it. */
const CrosshairCard = ({ crosshairs, className }: { crosshairs: string[]; className?: string }) => {
  const { copied, copy } = useCopied()
  const [latest, ...others] = crosshairs
  if (!latest) return null

  return (
    <RailCard
      title="Crosshairs"
      className={className}
      action={
        <Button size="xs" variant="ghost" onClick={() => copy(latest)} aria-live="polite">
          <CopyMark copied={copied} />
          <MorphLabel>{copied ? 'Copied' : 'Copy code'}</MorphLabel>
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <CrosshairTile code={latest} large />
        {others.length > 0 && (
          <>
            <span aria-hidden className="w-px self-stretch bg-border" />
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {others.map((code) => (
                <CrosshairTile key={code} code={code} />
              ))}
            </div>
          </>
        )}
      </div>
    </RailCard>
  )
}

const PARTY_LABELS = ['Solo', 'Duo', 'Trio', '4-stack', '5-stack']

/** One hue per size. */
const PARTY_COLORS = [
  'bg-neutral-400',
  'bg-violet-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-orange-500',
]

const PartyCard = ({ party, className }: { party: Player['party']; className?: string }) => {
  if (!party.usual) return null
  const total = party.sizes.reduce((a, b) => a + b, 0)
  const top = Math.max(...party.sizes)

  return (
    <RailCard title="Usual party" className={className}>
      <p className="text-body">
        {party.usual === 1
          ? 'Mostly queues solo'
          : `Mostly queues as a ${PARTY_LABELS[party.usual - 1]!.toLowerCase()}`}
      </p>
      <div className="mt-4 grid grid-cols-5 items-end gap-1.5" aria-label="Matches by party size">
        {party.sizes.map((count, i) => (
          <Tooltip
            key={PARTY_LABELS[i]}
            content={`${PARTY_LABELS[i]}: ${count} of ${total} matches`}
            trigger={
              <div
                className="grid gap-1.5 text-center"
                tabIndex={0}
                aria-label={`${PARTY_LABELS[i]}: ${count} of ${total} matches`}
              >
                <div className="flex h-14 items-end">
                  <div
                    className={cn('w-full rounded-[4px]', PARTY_COLORS[i])}
                    style={{ height: `${top ? Math.max((count / top) * 100, count ? 8 : 3) : 3}%` }}
                  />
                </div>
                <span className="text-caption text-muted">{PARTY_LABELS[i]}</span>
              </div>
            }
          />
        ))}
      </div>
    </RailCard>
  )
}

/**
 * Below md the cards bleed, so they join into one block and rows share one line. In two columns,
 * each column also gives up its inner bleed and a divider splits them.
 */
const JOINED_START = 'max-md:@xl:mr-0 max-md:@xl:border-r'
const JOINED_END = 'max-md:@xl:ml-0'
const JOINED_LOWER = 'max-md:border-t-0'

/** Side by side, Steam and party are the shorter pair, so they share the first row. */
export const ProfileRail = ({ player }: { player: Player }) => (
  <aside className="grid min-w-0 grid-cols-1 gap-4 *:min-w-0 max-md:gap-0 @xl:grid-cols-2 @5xl:grid-cols-1">
    <SteamCard player={player} className={JOINED_START} />
    <RanksCard
      player={player}
      className={cn(JOINED_END, JOINED_LOWER, '@xl:order-2 @5xl:order-none')}
    />
    <CrosshairCard
      crosshairs={player.crosshairs}
      className={cn(JOINED_START, JOINED_LOWER, '@xl:order-1 @5xl:order-none')}
    />
    <PartyCard
      party={player.party}
      className={cn(JOINED_END, JOINED_LOWER, 'max-md:@xl:border-t')}
    />
  </aside>
)
