import { motion, useReducedMotion } from 'motion/react'
import type { Ref } from 'react'
import { AutoHeight, FadeList, fade } from '@/components/ui/presence'
import { Segmented } from '@/components/ui/segmented'
import { Card } from '@/components/ui/surface'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { StorageReport } from '@/lib/admin'
import { formatBytes, plural, timeAgo } from '@/lib/format'
import { EASE_OUT_QUART } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface Segment {
  id: string
  label: string
  description: string
  bytes: number
  count?: number
  noun?: string
  /** Fill of the bar segment and the legend swatch. */
  swatch: string
}

/** Narrowest a segment gets, in px. */
const MIN_SEGMENT = 6

/** The whole disk, or only what subtick itself keeps on it. */
type Scope = 'disk' | 'subtick'

const SCOPES = [
  { id: 'disk', label: 'Whole disk' },
  { id: 'subtick', label: 'Instance' },
] as const

const segmentsOf = ({ usage, disk }: StorageReport, scope: Scope): Segment[] => {
  const own: Segment[] = [
    {
      id: 'clips',
      label: 'Clips',
      description: 'Recorded highlight videos',
      bytes: usage.clips.bytes,
      count: usage.clips.count,
      noun: 'video',
      swatch: 'bg-brand',
    },
    {
      id: 'demos',
      label: 'Demos',
      description: 'Downloaded match demos, kept while clips are recorded',
      bytes: usage.demos.bytes,
      count: usage.demos.count,
      noun: 'demo',
      swatch: 'bg-accent',
    },
    {
      id: 'thumbnails',
      label: 'Thumbnails',
      description: 'Posters shown on highlight cards',
      bytes: usage.thumbnails.bytes,
      count: usage.thumbnails.count,
      noun: 'image',
      swatch: 'bg-success',
    },
    {
      id: 'database',
      label: 'Database',
      description: 'Matches, moments, users and settings in Postgres',
      bytes: usage.database.bytes,
      swatch: 'bg-side-t',
    },
  ]
  if (usage.other.bytes > 0)
    own.push({
      id: 'other',
      label: 'Other objects',
      description: 'Files in the buckets subtick doesn’t recognise',
      bytes: usage.other.bytes,
      count: usage.other.count,
      noun: 'file',
      swatch: 'bg-muted',
    })
  if (scope === 'subtick' || !disk) return own
  // What the disk holds beyond subtick's data: other apps, the OS, SeaweedFS's own overhead.
  const rest = disk.used - own.reduce((sum, s) => sum + s.bytes, 0)
  if (rest > 0)
    own.push({
      id: 'system',
      label: 'Everything else',
      description: 'Other files on the same disk',
      bytes: rest,
      swatch: 'bg-muted/45',
    })

  return own
}

const percent = (part: number, whole: number) => {
  if (whole <= 0) return '0%'
  const value = (part / whole) * 100

  return value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`
}

export function StorageCard({ report }: { report: StorageReport }) {
  const { disk } = report
  const [preferred, setScope] = useLocalStorage<Scope>('subtick:storage-scope', 'disk')
  // Without the disk's size there's only subtick's data to show.
  const scope: Scope = disk ? preferred : 'subtick'
  const segments = segmentsOf(report, scope)
  const used = segments.reduce((sum, s) => sum + s.bytes, 0)
  const whole = scope === 'disk' && disk ? disk.total : used
  const lowSpace = disk !== null && disk.free / disk.total < 0.1

  // Every segment either view can show stays mounted, so switching eases widths instead of
  // popping segments in and out.
  const all = segmentsOf(report, 'disk')
  const shown = new Set(segments.map((s) => s.id))
  const bar = [
    ...all.map((s) => ({ ...s, visible: shown.has(s.id) && s.bytes > 0 })),
    {
      id: 'free',
      label: 'Free',
      bytes: disk?.free ?? 0,
      swatch: 'bg-transparent',
      visible: scope === 'disk' && disk !== null,
    },
  ]
  const firstVisible = bar.findIndex((s) => s.visible)
  const barTotal = bar.reduce((sum, s) => sum + (s.visible ? s.bytes : 0), 0)
  const reduce = useReducedMotion()

  return (
    <Card className="grid gap-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="font-display text-display tracking-tight tabular-nums">
            {scope === 'disk' && disk ? formatBytes(disk.free) : formatBytes(used)}
          </p>
          <p className="text-body text-muted">
            {scope === 'disk' && disk ? `free of ${formatBytes(disk.total)}` : 'used by subtick'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {disk && <Segmented label="Show" value={scope} options={SCOPES} onChange={setScope} />}
          <p className="text-small text-muted">Measured {timeAgo(report.measuredAt)}</p>
        </div>
      </div>

      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${formatBytes(s.bytes)}`).join(', ')}
        className="flex h-3 overflow-hidden rounded-sm bg-surface-2"
      >
        {bar.map((s, i) => (
          <motion.div
            key={s.id}
            title={s.visible ? `${s.label}: ${formatBytes(s.bytes)}` : undefined}
            // Shrinkable: when slivers' minimums overflow the bar, the larger segments give way.
            className="h-full overflow-hidden"
            initial={false}
            animate={{
              width: s.visible && barTotal > 0 ? `${(s.bytes / barTotal) * 100}%` : '0%',
              paddingLeft: s.visible && i > firstVisible ? 2 : 0,
              // However small its share, a segment stays visible as a sliver.
              minWidth: s.visible ? (i > firstVisible ? 2 : 0) + MIN_SEGMENT : 0,
              opacity: s.visible ? 1 : 0,
            }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE_OUT_QUART }}
          >
            <div className={cn('h-full rounded-sm', s.swatch)} />
          </motion.div>
        ))}
      </div>

      {lowSpace && (
        <p className="rounded-lg bg-danger/8 px-3 py-2 text-body text-danger">
          Less than 10% of the disk is free. New demos and clips fail to save once it fills up.
        </p>
      )}

      <AutoHeight>
        <ul className="grid gap-3">
          <FadeList>
            {segments.map((s) => (
              <LegendRow
                key={s.id}
                swatch={s.swatch}
                label={s.label}
                description={
                  s.count !== undefined && s.noun
                    ? `${s.description} · ${plural(s.count, s.noun)}`
                    : s.description
                }
                bytes={s.bytes}
                share={percent(s.bytes, whole)}
              />
            ))}
            {scope === 'disk' && disk && (
              <LegendRow
                key="free"
                swatch="bg-surface-2 ring-1 ring-inset ring-border-strong"
                label="Free"
                description="Room left for new demos and clips"
                bytes={disk.free}
                share={percent(disk.free, whole)}
              />
            )}
          </FadeList>
        </ul>
      </AutoHeight>

      {!disk && (
        <p className="border-t pt-4 text-small text-muted">
          Set <code className="font-mono">S3_DISK_STATUS_URL</code> to the SeaweedFS volume server’s{' '}
          <code className="font-mono">/status</code> to see the disk’s size and free space.
        </p>
      )}
    </Card>
  )
}

const LegendRow = ({
  ref,
  swatch,
  label,
  description,
  bytes,
  share,
}: {
  /** FadeList's popLayout measures leaving rows through it. */
  ref?: Ref<HTMLLIElement>
  swatch: string
  label: string
  description: string
  bytes: number
  share: string
}) => (
  <motion.li ref={ref} className="flex items-start gap-3" {...fade}>
    <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', swatch)} />
    <div className="min-w-0 flex-1">
      <p className="text-body">{label}</p>
      <p className="text-small text-muted">{description}</p>
    </div>
    <div className="shrink-0 text-right tabular-nums">
      <p className="text-body">{formatBytes(bytes)}</p>
      <p className="text-small text-muted">{share}</p>
    </div>
  </motion.li>
)
