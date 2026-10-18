import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, Skeleton } from '@/components/ui/surface'
import { type StorageReport, storageQuery } from '@/lib/admin'
import { formatBytes, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/storage')({
  loader: ({ context }) => context.queryClient.prefetchQuery(storageQuery),
  component: StoragePage,
})

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

const segmentsOf = ({ usage, disk }: StorageReport): Segment[] => {
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
  if (!disk) return own
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

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

const percent = (part: number, whole: number) => {
  if (whole <= 0) return '0%'
  const value = (part / whole) * 100
  return value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`
}

function StoragePage() {
  const storage = useQuery(storageQuery)

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        What subtick keeps on the disk and how much room is left.
      </p>
      {storage.isPending ? (
        <Skeleton className="h-72" />
      ) : storage.error ? (
        <Card className="p-6 text-sm text-danger">{storage.error.message}</Card>
      ) : (
        <StorageCard report={storage.data} />
      )}
    </section>
  )
}

function StorageCard({ report }: { report: StorageReport }) {
  const segments = segmentsOf(report)
  const { disk } = report
  const used = segments.reduce((sum, s) => sum + s.bytes, 0)
  // Without the disk's size the bar is just subtick's data, split by kind.
  const whole = disk ? disk.total : used
  const lowSpace = disk !== null && disk.free / disk.total < 0.1

  return (
    <Card className="grid gap-6 p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <p className="font-serif text-3xl tracking-tight tabular-nums">
            {disk ? formatBytes(disk.free) : formatBytes(used)}
          </p>
          <p className="text-sm text-muted">
            {disk ? `free of ${formatBytes(disk.total)}` : 'used by subtick'}
          </p>
        </div>
        <p className="text-[13px] text-muted">Measured {timeAgo(report.measuredAt)}</p>
      </div>

      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${formatBytes(s.bytes)}`).join(', ')}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2"
      >
        {segments.map(
          (s) =>
            s.bytes > 0 && (
              <div
                key={s.id}
                title={`${s.label}: ${formatBytes(s.bytes)}`}
                // A sliver stays visible however small its share.
                className={cn('h-full min-w-1 transition-[flex-grow] duration-500', s.swatch)}
                style={{ flexGrow: s.bytes, flexBasis: 0 }}
              />
            ),
        )}
        {disk && <div className="h-full" style={{ flexGrow: disk.free, flexBasis: 0 }} />}
      </div>

      {lowSpace && (
        <p className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger">
          Less than 10% of the disk is free. New demos and clips fail to save once it fills up.
        </p>
      )}

      <ul className="grid gap-3">
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
        {disk && (
          <LegendRow
            swatch="bg-surface-2 ring-1 ring-inset ring-border-strong"
            label="Free"
            description="Room left for new demos and clips"
            bytes={disk.free}
            share={percent(disk.free, whole)}
          />
        )}
      </ul>

      {!disk && (
        <p className="border-t pt-4 text-[13px] text-muted">
          Set <code className="font-mono">S3_DISK_STATUS_URL</code> to the SeaweedFS volume server’s{' '}
          <code className="font-mono">/status</code> to see the disk’s size and free space.
        </p>
      )}
    </Card>
  )
}

const LegendRow = ({
  swatch,
  label,
  description,
  bytes,
  share,
}: {
  swatch: string
  label: string
  description: string
  bytes: number
  share: string
}) => (
  <li className="flex items-start gap-3">
    <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', swatch)} />
    <div className="min-w-0 flex-1">
      <p className="text-sm">{label}</p>
      <p className="text-[13px] text-muted">{description}</p>
    </div>
    <div className="shrink-0 text-right tabular-nums">
      <p className="text-sm">{formatBytes(bytes)}</p>
      <p className="text-[13px] text-muted">{share}</p>
    </div>
  </li>
)
