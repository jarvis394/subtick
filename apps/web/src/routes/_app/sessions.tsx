import { useInfiniteQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { z } from 'zod'
import { ClipViewerDialog, type ReelSource } from '@/components/clip-viewer'
import { EmptyState } from '@/components/empty-state'
import { LoadFailed } from '@/components/load-failed'
import { playerSlug } from '@/components/player-link'
import { SessionSection } from '@/components/sessions/session-section'
import { SessionsIcon } from '@/components/sessions/sessions-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { clipMask, clipViewerSearch } from '@/lib/highlights'
import { meQuery, playerQuery, sessionsQuery } from '@/lib/queries'
import { sessionAnchor } from '@/lib/sessions'

const sessionsSearch = clipViewerSearch.extend({
  /** Whose sessions; the signed-in user's when absent. */
  player: z.string().optional(),
  /** Reach back at least this far, for a link to one session further down the page. */
  until: z.iso.datetime().optional(),
})

export const Route = createFileRoute('/_app/sessions')({
  head: () => ({ meta: [{ title: 'Sessions · subtick' }] }),
  validateSearch: sessionsSearch,
  loaderDeps: ({ search: { player, until } }) => ({ player, until }),
  // Awaited so a link's fragment finds its session once the page lands.
  loader: async ({ context: { queryClient }, deps: { player, until } }) => {
    const me = await queryClient.ensureQueryData(meQuery)
    const slug = player ?? me.steamLinks[0]?.steamId

    if (slug) await queryClient.prefetchInfiniteQuery(sessionsQuery(slug, until))
  },
  component: SessionsPage,
})

/** Sessions rendered with the navigation; the rest follow once the page is on screen. */
const FIRST_SESSIONS = 2

const SessionsSkeleton = () => (
  <div aria-hidden className="grid gap-6">
    <Skeleton className="h-7 w-52 rounded" />
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-48 shrink-0 rounded-xl md:w-auto md:flex-1" />
      ))}
    </div>
    <Skeleton className="h-64" />
  </div>
)

function SessionsPage() {
  const { player, until, clip } = Route.useSearch()
  const navigate = useNavigate()
  const { data: me } = useSuspenseQuery(meQuery)
  const own = me.steamLinks.find((l) => l.steamId === player || l.vanity === player)
  const slug = player ?? me.steamLinks[0]?.steamId
  const other = player && !own ? player : undefined
  const profile = useQuery({ ...playerQuery(other ?? ''), enabled: Boolean(other) })
  const sessions = useInfiniteQuery({
    ...sessionsQuery(slug ?? '', until),
    enabled: Boolean(slug),
  })
  const [reel, setReel] = useState<ReelSource>({ kinds: [] })
  const items = sessions.data?.pages.flatMap((p) => p.items) ?? []
  const { hash } = useLocation()
  const linked = items.findIndex((s) => sessionAnchor(s.id) === hash)
  // Every session is a full table, and rendering them all held the navigation up. It lands with
  // the first few (through a linked one, so its fragment scrolls there); the rest render after.
  const shown = useDeferredValue(items, items.slice(0, Math.max(FIRST_SESSIONS, linked + 1)))

  return (
    <div>
      {other && (
        <Link
          to="/players/$player"
          params={{ player: profile.data ? playerSlug(profile.data) : other }}
          className="mb-4 inline-flex items-center gap-1 text-body text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Profile
        </Link>
      )}
      <h1 className="mb-6 truncate font-display text-display tracking-tight">
        {other && profile.data ? `${profile.data.name}’s sessions` : 'Sessions'}
      </h1>

      {!slug ? (
        <EmptyState
          icon={<SessionsIcon />}
          title="No sessions yet"
          description="Link your Steam account and your matches get grouped by sitting."
          action={
            <Button size="sm" render={<Link to="/setup" />}>
              Finish setup
            </Button>
          }
        />
      ) : sessions.isPending ? (
        <SessionsSkeleton />
      ) : sessions.isError && items.length === 0 ? (
        <LoadFailed
          title="Couldn’t load sessions"
          onRetry={() => void sessions.refetch()}
          retrying={sessions.isRefetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SessionsIcon />}
          title="No sessions yet"
          description="Matches played within a few hours of each other group here once they’re analyzed."
        />
      ) : (
        <div className="grid grid-cols-1 gap-16">
          {shown.map((session) => (
            <SessionSection key={session.id} session={session} onOpenReel={setReel} />
          ))}
        </div>
      )}

      {sessions.hasNextPage && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => sessions.fetchNextPage()}
            loading={sessions.isFetchingNextPage}
          >
            Show more
          </Button>
        </div>
      )}

      <ClipViewerDialog
        clipId={clip}
        source={reel}
        onSelect={(id) =>
          navigate({
            to: '.',
            search: (s) => ({ ...s, clip: id }),
            mask: clipMask(id),
            replace: true,
            resetScroll: false,
          })
        }
        onClose={() =>
          navigate({ to: '.', search: (s) => ({ ...s, clip: undefined }), resetScroll: false })
        }
      />
    </div>
  )
}
