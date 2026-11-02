import { mapName } from '@subtick/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { MapIcon, matchName } from '@/components/map-icon'
import { MatchStatusBadge, isProcessing } from '@/components/match-status'
import { Button, IconButton } from '@/components/ui/button'
import { FadeItem, FadeList } from '@/components/ui/presence'
import { Card, Skeleton } from '@/components/ui/surface'
import {
  type StoredHighlight,
  type StoredMatch,
  storedHighlightsQuery,
  storedMatchesQuery,
} from '@/lib/admin'
import { ApiError, api, unwrap } from '@/lib/api'
import { formatBytes, formatDate, plural, timeAgo } from '@/lib/format'
import { KIND_LABEL } from '@/lib/highlights'
import { notifyError } from '@/lib/notify'

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
          <p className="text-small text-muted">{description}</p>
        </div>
        {items.length > 0 && (
          <p className="text-small text-muted tabular-nums">
            {plural(items.length, noun)} · {formatBytes(total)}
          </p>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : query.error ? (
        <p className="text-body text-danger select-text">{query.error.message}</p>
      ) : items.length === 0 ? (
        <p className="text-body text-muted">{empty}</p>
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
      <p className="truncate text-body">{title}</p>
      <p className="truncate text-small text-muted">{meta}</p>
    </div>
    <div className="shrink-0 text-right tabular-nums">
      <p className="text-body">{formatBytes(bytes)}</p>
      {breakdown && <p className="text-small text-muted">{breakdown}</p>}
    </div>
    {action}
  </li>
)

export function RecordedHighlights() {
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

export function StoredMatches() {
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
