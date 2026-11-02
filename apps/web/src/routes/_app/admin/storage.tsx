import { mapName } from '@subtick/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, type Ref, useState } from 'react'
import { MapIcon, matchName } from '@/components/map-icon'
import { MatchStatusBadge, isProcessing } from '@/components/match-status'
import { Button, IconButton } from '@/components/ui/button'
import { AutoHeight, FadeItem, FadeList, fade } from '@/components/ui/presence'
import { Segmented } from '@/components/ui/segmented'
import { Card, Skeleton } from '@/components/ui/surface'
import {
  type StorageReport,
  type StoredHighlight,
  type StoredMatch,
  storageQuery,
  storedHighlightsQuery,
  storedMatchesQuery,
} from '@/lib/admin'
import { ApiError, api, unwrap } from '@/lib/api'
import { formatBytes, formatDate, timeAgo } from '@/lib/format'
import { KIND_LABEL } from '@/lib/highlights'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { notifyError } from '@/lib/notify'
import { EASE_OUT_QUART } from '@/lib/motion'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/storage')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(storageQuery),
      context.queryClient.prefetchQuery(storedHighlightsQuery),
      context.queryClient.prefetchQuery(storedMatchesQuery),
    ]),
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
        <Card className="p-6 text-sm text-danger select-text">{storage.error.message}</Card>
      ) : (
        <StorageCard report={storage.data} />
      )}
      <RecordedHighlights />
      <StoredMatches />
    </section>
  )
}

function StorageCard({ report }: { report: StorageReport }) {
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
          <p className="font-serif text-3xl tracking-tight tabular-nums">
            {scope === 'disk' && disk ? formatBytes(disk.free) : formatBytes(used)}
          </p>
          <p className="text-sm text-muted">
            {scope === 'disk' && disk ? `free of ${formatBytes(disk.total)}` : 'used by subtick'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {disk && <Segmented label="Show" value={scope} options={SCOPES} onChange={setScope} />}
          <p className="text-[13px] text-muted">Measured {timeAgo(report.measuredAt)}</p>
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
        <p className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger">
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
        <p className="border-t pt-4 text-[13px] text-muted">
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
      <p className="text-sm">{label}</p>
      <p className="text-[13px] text-muted">{description}</p>
    </div>
    <div className="shrink-0 text-right tabular-nums">
      <p className="text-sm">{formatBytes(bytes)}</p>
      <p className="text-[13px] text-muted">{share}</p>
    </div>
  </motion.li>
)

/** Rows shown before "Show all", so a long history doesn't bury the page. */
const PREVIEW_ROWS = 8

const CONFLICT_MESSAGE = {
  recording: 'It’s being recorded right now. Try again once it’s done.',
  processing: 'It’s still being processed. Stop it or wait until it’s done.',
} as const

/** A delete that refreshes everything it could have changed: the report, these lists, the app's pages. */
const useDelete = <T,>(remove: (id: string) => Promise<T>) => {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { inlineError: true },
    mutationFn: remove,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (error) => {
      const code = error instanceof ApiError && error.status === 409 ? error.message : null
      notifyError(
        'Couldn’t delete it',
        code && code in CONFLICT_MESSAGE
          ? new Error(CONFLICT_MESSAGE[code as keyof typeof CONFLICT_MESSAGE])
          : error,
      )
    },
  })
}

function ItemsCard<T extends { id: string; bytes: number }>({
  title,
  description,
  empty,
  query,
  noun,
  children,
}: {
  title: string
  description: string
  empty: string
  query: { isPending: boolean; error: Error | null; data: T[] | undefined }
  noun: string
  children: (item: T) => ReactNode
}) {
  const [all, setAll] = useState(false)
  const items = query.data ?? []
  const shown = all ? items : items.slice(0, PREVIEW_ROWS)
  const total = items.reduce((sum, item) => sum + item.bytes, 0)

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
        {items.length > 0 && (
          <p className="text-[13px] text-muted tabular-nums">
            {plural(items.length, noun)} · {formatBytes(total)}
          </p>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : query.error ? (
        <p className="text-sm text-danger select-text">{query.error.message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="-mx-2 grid">
          <FadeList>
            {shown.map((item) => (
              <FadeItem key={item.id}>{children(item)}</FadeItem>
            ))}
          </FadeList>
        </ul>
      )}
      {items.length > PREVIEW_ROWS && (
        <Button
          size="sm"
          variant="ghost"
          className="justify-self-start"
          onClick={() => setAll(!all)}
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
      )}
    </Card>
  )
}

const ItemRow = ({
  map,
  title,
  meta,
  bytes,
  breakdown,
  action,
}: {
  map: string | null
  title: ReactNode
  meta: ReactNode
  bytes: number
  breakdown?: string
  action: ReactNode
}) => (
  <li className="flex items-center gap-3 rounded-lg px-2 py-2">
    <MapIcon map={map} className="size-8" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm">{title}</p>
      <p className="truncate text-[13px] text-muted">{meta}</p>
    </div>
    <div className="shrink-0 text-right tabular-nums">
      <p className="text-sm">{formatBytes(bytes)}</p>
      {breakdown && <p className="text-[13px] text-muted">{breakdown}</p>}
    </div>
    {action}
  </li>
)

function RecordedHighlights() {
  const highlights = useQuery(storedHighlightsQuery)
  return (
    <ItemsCard
      title="Recorded highlights"
      description="Deleting a clip removes its video; the moment stays and can be recorded again."
      empty="No clips recorded yet."
      query={highlights}
      noun="clip"
    >
      {(highlight) => <HighlightItem highlight={highlight} />}
    </ItemsCard>
  )
}

function HighlightItem({ highlight }: { highlight: StoredHighlight }) {
  const remove = useDelete((id) => unwrap(api.admin.storage.highlights({ id }).delete()))
  const name = `${KIND_LABEL[highlight.kind]}${highlight.player ? ` · ${highlight.player}` : ''}`
  return (
    <ItemRow
      map={highlight.map}
      title={
        <Link to="/clips/$id" params={{ id: highlight.id }} className="link">
          {name}
        </Link>
      }
      meta={`${mapName(highlight.map)} · R${highlight.round} · recorded ${timeAgo(highlight.recordedAt)}`}
      bytes={highlight.bytes}
      action={
        <IconButton
          size="sm"
          tone="danger"
          label="Delete clip"
          loading={remove.isPending}
          onClick={() => {
            if (confirm(`Delete the ${name} clip? Its video is removed for everyone.`))
              remove.mutate(highlight.id)
          }}
        >
          <Trash2 />
        </IconButton>
      }
    />
  )
}

function StoredMatches() {
  const matches = useQuery(storedMatchesQuery)
  return (
    <ItemsCard
      title="Matches"
      description="Deleting a match removes it for everyone: its demo, stats, moments and clips."
      empty="No matches yet."
      query={matches}
      noun="match"
    >
      {(match) => <MatchItem match={match} />}
    </ItemsCard>
  )
}

function MatchItem({ match }: { match: StoredMatch }) {
  const remove = useDelete((id) => unwrap(api.admin.storage.matches({ id }).delete()))
  const name = matchName(match.map, match.status)
  const score =
    match.scoreStartedCt !== null && match.scoreStartedT !== null
      ? `${match.scoreStartedCt}–${match.scoreStartedT}`
      : null
  const processing = isProcessing(match.status)
  const parts = [
    match.demoBytes > 0 && `demo ${formatBytes(match.demoBytes)}`,
    match.clips > 0 && `${plural(match.clips, 'clip')} ${formatBytes(match.clipBytes)}`,
  ].filter(Boolean)

  return (
    <ItemRow
      map={match.map}
      title={
        <span className="inline-flex items-center gap-2">
          <Link to="/matches/$id" params={{ id: match.id }} className="link truncate">
            {name}
          </Link>
          <MatchStatusBadge status={match.status} />
        </span>
      }
      meta={[score, formatDate(match.playedAt ?? match.createdAt)].filter(Boolean).join(' · ')}
      bytes={match.bytes}
      breakdown={parts.join(' · ') || undefined}
      action={
        <IconButton
          size="sm"
          tone="danger"
          label={processing ? 'Still processing' : 'Delete match'}
          disabled={processing}
          loading={remove.isPending}
          onClick={() => {
            const clips = match.clips > 0 ? `, ${plural(match.clips, 'clip')}` : ''
            if (
              confirm(
                `Delete ${name}${score ? ` (${score})` : ''} for everyone? Its demo, stats, moments${clips} are removed. This can’t be undone.`,
              )
            )
              remove.mutate(match.id)
          }}
        >
          <Trash2 />
        </IconButton>
      }
    />
  )
}
