import { type SkillArea, type SkillMetric, type SkillStanding, skillSummary } from '@subtick/domain'
import { ArrowDown, ArrowUp, ChevronUp, Minus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover } from '@/components/ui/popover'
import { Card } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { CardHeader } from './card-header'
import { formatImpact, type Played } from './facts'

type Area = ReturnType<typeof skillSummary>['areas'][number]

const percent = (n: number) => `${Math.round(n)}%`

const oneDecimal = (n: number) => n.toFixed(1)

const AREAS: Record<SkillArea, { title: string; how: string }> = {
  form: {
    title: 'Form',
    how: 'Average match rating, where 1.00 is an even game.',
  },
  aim: {
    title: 'Aim',
    how: 'Out of 100, from accuracy, head hits, headshot kills and counter-strafing.',
  },
  utility: {
    title: 'Utility',
    how: 'Grenade damage a round. The stats below are per match.',
  },
  impact: {
    title: 'Impact',
    how: 'How much round win probability the player swung, on average. The stats below are per match.',
  },
}

const METRICS: Record<SkillMetric, { label: string; format: (n: number) => string }> = {
  form: { label: 'Rating', format: (n) => n.toFixed(2) },
  aim: { label: 'Aim', format: (n) => String(Math.round(n)) },
  utility: { label: 'Utility damage', format: oneDecimal },
  impact: { label: 'Impact', format: formatImpact },
  kd: { label: 'K/D', format: (n) => n.toFixed(2) },
  adr: { label: 'ADR', format: (n) => String(Math.round(n)) },
  kast: { label: 'KAST', format: percent },
  openings: { label: 'Opening duels won', format: percent },
  accuracy: { label: 'Accuracy', format: percent },
  headHits: { label: 'Head hits', format: percent },
  counterStrafe: { label: 'Counter-strafed', format: percent },
  headshots: { label: 'Headshot kills', format: percent },
  flashAssists: { label: 'Flash assists', format: oneDecimal },
  enemiesFlashed: { label: 'Enemies flashed', format: oneDecimal },
  openingKills: { label: 'Opening kills', format: oneDecimal },
  clutches: { label: 'Clutches won', format: oneDecimal },
  tradeKills: { label: 'Trade kills', format: oneDecimal },
  multiKillRounds: { label: 'Multi-kill rounds', format: oneDecimal },
}

const FILL: Record<SkillStanding, string> = {
  above: 'bg-success/75',
  level: 'bg-foreground/60',
  below: 'bg-danger/65',
}

const PIP = { up: 'bg-success', flat: 'bg-foreground/25', down: 'bg-danger' }

const TREND_ICON = {
  up: <ArrowUp aria-label="Up" className="size-3 text-success handheld:size-4" />,
  flat: <Minus aria-label="Flat" className="size-3 text-muted handheld:size-4" />,
  down: <ArrowDown aria-label="Down" className="size-3 text-danger handheld:size-4" />,
}

const fillOf = (value: number, [min, max]: Area['scale']) =>
  `${Math.min(Math.max((value - min) / (max - min), 0), 1) * 100}%`

const Well = ({
  label,
  value,
  scale,
  fill,
  format,
}: {
  label: string
  value: number | null
  scale: Area['scale']
  fill: string
  format: (n: number) => string
}) => (
  <div>
    <div className="relative h-20 overflow-hidden rounded-lg bg-surface-2">
      {value !== null && (
        <div
          className={cn('absolute inset-x-0 bottom-0', fill)}
          style={{ height: fillOf(value, scale) }}
        />
      )}
    </div>
    <p className="mt-1.5 text-lead font-medium tabular-nums">
      <span className="sr-only">{label}: </span>
      {value === null ? '–' : format(value)}
    </p>
  </div>
)

const AreaDetails = ({
  area,
  size,
  open,
  onOpenChange,
}: {
  area: Area
  size: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { title, how } = AREAS[area.area]
  const { label, format } = METRICS[area.area]
  const compared = area.metrics.filter((m) => m.trend)
  const up = compared.filter((m) => m.trend === 'up').length

  return (
    <Popover
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      openOnHover
      side="top"
      sideOffset={8}
      className="w-80 max-w-[calc(100vw-2rem)] p-4 pt-3"
      trigger={
        <Button
          size="xs"
          variant="ghost"
          className="-mx-1.5 mt-2 -mb-1.5 w-[calc(100%+0.75rem)] justify-start gap-2 px-1.5 text-caption font-normal"
        >
          <span aria-hidden className="flex shrink-0 gap-0.5">
            {area.metrics.map((m) => (
              <span
                key={m.metric}
                className={cn('size-1.5 rounded-full', m.trend ? PIP[m.trend] : 'bg-foreground/15')}
              />
            ))}
          </span>
          <span className="min-w-0 truncate tabular-nums">
            {compared.length ? `${up} of ${compared.length} up` : 'Details'}
          </span>
          <ChevronUp aria-hidden className="ml-auto" />
        </Button>
      }
    >
      <div className="text-small handheld:text-lead">
        <h4 aria-hidden className="text-body font-medium handheld:text-title">
          {title}
        </h4>
        <p className="mt-0.5 text-caption text-muted handheld:mt-1 handheld:text-body">{how}</p>
        <table className="mt-2 w-full tabular-nums handheld:mt-4">
          <thead className="text-caption text-muted handheld:text-small">
            <tr>
              <td />
              <th scope="col" className="pb-1 pl-4 text-right font-normal whitespace-nowrap">
                Last {size}
              </th>
              <th scope="col" className="pb-1 pl-4 text-right font-normal whitespace-nowrap">
                Previous {size}
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>*]:pb-2">
            {area.metrics.map((m) => (
              <tr key={m.metric}>
                <th scope="row" className="py-1 text-left font-normal handheld:py-1.5">
                  {METRICS[m.metric].label}
                </th>
                <td className="py-1 pl-4 text-right font-medium handheld:py-1.5">
                  <span className="inline-flex items-center gap-1">
                    {m.trend && TREND_ICON[m.trend]}
                    {m.value === null ? '–' : METRICS[m.metric].format(m.value)}
                  </span>
                </td>
                <td className="py-1 pl-4 text-right text-muted handheld:py-1.5">
                  {m.previous === null ? '–' : METRICS[m.metric].format(m.previous)}
                </td>
              </tr>
            ))}
          </tbody>
          {area.lobby !== null && (
            <tfoot className="border-t">
              <tr>
                <th scope="row" className="pt-2 text-left font-normal whitespace-nowrap text-muted">
                  Lobby {label.toLowerCase()}
                </th>
                <td className="pt-2 pl-4 text-right font-medium">{format(area.lobby)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Popover>
  )
}

const AreaCard = ({
  area,
  size,
  open,
  onOpenChange,
}: {
  area: Area
  size: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { title } = AREAS[area.area]
  const { format } = METRICS[area.area]

  return (
    <div className="min-w-0 bg-surface p-4 pt-3">
      <CardHeader title={title} level="h3" />
      <div className="grid grid-cols-2 gap-1.5">
        <Well
          label={`Last ${size}`}
          value={area.value}
          scale={area.scale}
          fill={FILL[area.standing ?? 'level']}
          format={format}
        />
        <Well
          label={`Previous ${size}`}
          value={area.previous}
          scale={area.scale}
          fill="bg-foreground/20"
          format={format}
        />
      </div>
      <AreaDetails area={area} size={size} open={open} onOpenChange={onOpenChange} />
    </div>
  )
}

/** Four areas of play, each the latest matches against the ones before and the lobby. */
export const SkillCards = ({ history }: { history: Played[] }) => {
  // One place for what's open: hover and click would otherwise each leave a popover up.
  const [openArea, setOpenArea] = useState<SkillArea | null>(null)
  const { size, areas } = skillSummary(history)

  return (
    <section>
      <h2 className="mb-4 flex flex-wrap items-baseline gap-x-3 text-title font-medium">
        Skills
        <span className="text-small font-normal text-muted tabular-nums">
          {history.length < 2 ? 'of the last match' : `last ${size} matches vs the ${size} before`}
        </span>
      </h2>
      <Card bleed className="overflow-hidden md:-mx-4">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {areas.map((area) => (
            <AreaCard
              key={area.area}
              area={area}
              size={size}
              open={openArea === area.area}
              onOpenChange={(next) =>
                setOpenArea((current) =>
                  next ? area.area : current === area.area ? null : current,
                )
              }
            />
          ))}
        </div>
      </Card>
    </section>
  )
}
