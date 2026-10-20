import { CROSSHAIR_STYLES, decodeCrosshair, mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { mapPreviewUrl } from '@/components/map-icon'
import { RankBadge } from '@/components/rank-badge'
import { SteamIcon } from '@/components/steam-icon'
import { Button } from '@/components/ui/button'
import { MorphLabel } from '@/components/ui/morph-label'
import { Card } from '@/components/ui/surface'
import { Tooltip } from '@/components/ui/tooltip'
import { timeAgo } from '@/lib/format'
import type { Player } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CrosshairPreview } from './crosshair-preview'

const RailCard = ({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <Card className={cn('p-4', className)}>
    <div className="mb-3 flex h-7 items-center justify-between gap-3">
      <h2 className="text-[15px] font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </Card>
)

const rank = (mode: 'premier' | 'competitive' | 'wingman', after: number) => ({
  mode,
  after,
  before: after,
  change: 0,
  wins: 0,
})

export const RanksCard = ({ ranks }: { ranks: Player['ranks'] }) => {
  const rows = [
    ranks.premier && {
      label: 'Premier',
      current: <RankBadge rank={rank('premier', ranks.premier.current)} showChange={false} />,
      detail: <RankBadge rank={rank('premier', ranks.premier.best)} showChange={false} />,
    },
    ranks.competitive && {
      label: 'Competitive',
      current: <RankBadge rank={rank('competitive', ranks.competitive.group)} />,
      detail: <span className="text-[13px] text-muted">{mapName(ranks.competitive.map)}</span>,
    },
    ranks.wingman && {
      label: 'Wingman',
      current: <RankBadge rank={rank('wingman', ranks.wingman.group)} />,
      detail: <span className="text-[13px] text-muted">{mapName(ranks.wingman.map)}</span>,
    },
  ].filter((row) => row !== null)
  if (!rows.length) return null

  return (
    <RailCard title="Ranks">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2.5 text-sm">
        <span className="text-[12px] text-muted">Mode</span>
        <span className="text-[12px] text-muted">Latest</span>
        <span className="text-right text-[12px] text-muted">
          {ranks.premier ? 'Best / map' : 'Map'}
        </span>
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <span>{row.label}</span>
            <span>{row.current}</span>
            <span className="flex justify-end">{row.detail}</span>
          </div>
        ))}
      </div>
    </RailCard>
  )
}

/** The crosshair over the map it was last used on, zoomed in, with its code to copy. */
export const CrosshairCard = ({ crosshair }: { crosshair: Player['crosshair'] }) => {
  const [copied, setCopied] = useState(false)
  const decoded = crosshair ? decodeCrosshair(crosshair.code) : null
  if (!crosshair || !decoded) return null
  const preview = mapPreviewUrl(crosshair.map)

  const copy = async () => {
    await navigator.clipboard.writeText(crosshair.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <RailCard
      title="Crosshair"
      action={
        <Button size="xs" variant="ghost" onClick={copy} aria-live="polite">
          {copied ? <Check /> : <Copy />}
          <MorphLabel>{copied ? 'Copied' : 'Copy code'}</MorphLabel>
        </Button>
      }
    >
      <div className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-xl bg-neutral-800">
        {preview && (
          // Darkened and soft so any crosshair color reads against it, as it would in game.
          <img
            src={preview}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full scale-110 object-cover blur-[1px] brightness-[0.55]"
          />
        )}
        <CrosshairPreview crosshair={decoded} className="relative size-full" />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {CROSSHAIR_STYLES[decoded.style]}. From{' '}
        <Link to="/matches/$id" params={{ id: crosshair.matchId }} className="link text-foreground">
          {mapName(crosshair.map)}
        </Link>
        , {timeAgo(crosshair.playedAt)}.
      </p>
      <p className="mt-1 truncate font-mono text-[12px] text-muted/80 select-all">
        {crosshair.code}
      </p>
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

export const PartyCard = ({ party }: { party: Player['party'] }) => {
  if (!party.usual) return null
  const total = party.sizes.reduce((a, b) => a + b, 0)
  const top = Math.max(...party.sizes)

  return (
    <RailCard title="Usual party">
      <p className="text-sm">
        {party.usual === 1
          ? 'Mostly queues solo'
          : `Mostly queues as a ${PARTY_LABELS[party.usual - 1]!.toLowerCase()}`}
      </p>
      <div className="mt-4 grid grid-cols-5 items-end gap-1.5" aria-label="Matches by party size">
        {party.sizes.map((count, i) => (
          <Tooltip
            key={i}
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
                <span className="text-[11px] text-muted">{PARTY_LABELS[i]}</span>
              </div>
            }
          />
        ))}
      </div>
    </RailCard>
  )
}

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

export const SteamCard = ({ player }: { player: Player }) => (
  <RailCard
    title="Steam"
    action={
      <Button
        size="xs"
        variant="ghost"
        render={
          <a
            href={`https://steamcommunity.com/profiles/${player.steamId}`}
            target="_blank"
            rel="noreferrer"
          />
        }
      >
        Profile <ExternalLink />
      </Button>
    }
  >
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2">
        <SteamIcon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{player.personaName ?? player.name}</p>
        <p className="font-mono text-[12px] text-muted select-all">{player.steamId}</p>
      </div>
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
      <div>
        <dt className="text-[12px] text-muted">Last match</dt>
        <dd className="mt-0.5">{player.lastMatchAt ? timeAgo(player.lastMatchAt) : '–'}</dd>
      </div>
      <div>
        <dt className="text-[12px] text-muted">On subtick</dt>
        <dd className="mt-0.5">
          {player.memberSince
            ? `Since ${MONTH_YEAR.format(new Date(player.memberSince))}`
            : 'Not yet'}
        </dd>
      </div>
    </dl>
  </RailCard>
)
