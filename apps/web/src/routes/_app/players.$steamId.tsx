import { Tabs } from '@base-ui/react/tabs'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { ErrorPage } from '@/components/error-page'
import { MapsTab } from '@/components/profile/maps-tab'
import { MatchesTab } from '@/components/profile/matches-tab'
import { OverviewTab } from '@/components/profile/overview-tab'
import { ProfileBanner, ProfileIdentity } from '@/components/profile/profile-header'
import { CrosshairCard, PartyCard, RanksCard, SteamCard } from '@/components/profile/side-rail'
import { TeammatesTab } from '@/components/profile/teammates-tab'
import { Skeleton } from '@/components/ui/surface'
import { ApiError } from '@/lib/api'
import { clipMask, clipViewerSearch } from '@/lib/highlights'
import { playerQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'maps', label: 'Maps' },
  { id: 'teammates', label: 'Teammates' },
] as const
type Tab = (typeof TABS)[number]['id']

export const Route = createFileRoute('/_app/players/$steamId')({
  validateSearch: clipViewerSearch.extend({
    tab: z.enum(TABS.map((t) => t.id) as [Tab, ...Tab[]]).optional(),
  }),
  loader: ({ context, params }) => context.queryClient.prefetchQuery(playerQuery(params.steamId)),
  component: ProfilePage,
})

const ProfileSkeleton = () => (
  <div aria-hidden>
    <Skeleton className="-mx-4 -mt-6 aspect-[3/1] max-h-64 rounded-none md:mx-0 md:mt-0 md:rounded-2xl" />
    <div className="mt-4 flex items-end gap-5 px-1 md:px-6">
      <Skeleton className="-mt-12 size-24 rounded-full ring-4 ring-surface md:-mt-14 md:size-28" />
      <Skeleton className="mb-2 h-7 w-48 rounded" />
    </div>
  </div>
)

function ProfilePage() {
  const { steamId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const player = useQuery(playerQuery(steamId))
  const tab = search.tab ?? 'overview'

  if (player.isError)
    return player.error instanceof ApiError && player.error.status === 404 ? (
      <ErrorPage />
    ) : (
      <p className="text-sm text-danger">Couldn’t load this profile. Try reloading the page.</p>
    )
  if (!player.data) return <ProfileSkeleton />
  const p = player.data

  return (
    <div>
      {/* The rail runs from the top of the page, beside the banner. */}
      <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:items-start">
        <div className="min-w-0">
          <ProfileBanner player={p} />
          <div className="mt-4 px-1 md:px-6">
            <ProfileIdentity player={p} />
          </div>
          <Tabs.Root
            value={tab}
            onValueChange={(next) =>
              navigate({
                search: (s) => ({ ...s, tab: next === 'overview' ? undefined : (next as Tab) }),
                replace: true,
                resetScroll: false,
              })
            }
            className="mt-8 min-w-0"
          >
            <Tabs.List
              aria-label="Profile"
              className="relative mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-control bg-surface-2/70 p-0.5"
            >
              {TABS.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  value={t.id}
                  className={cn(
                    'relative z-10 h-8 cursor-pointer pointer-coarse:h-10 rounded-lg px-3 text-sm whitespace-nowrap text-muted outline-none select-none transition-colors',
                    'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:text-foreground',
                  )}
                >
                  {t.label}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator className="absolute top-0 left-0 z-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-lg border bg-surface-3 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
            </Tabs.List>
            <Tabs.Panel value="overview">
              <OverviewTab player={p} />
            </Tabs.Panel>
            <Tabs.Panel value="matches">
              <MatchesTab steamId={steamId} />
            </Tabs.Panel>
            <Tabs.Panel value="maps">
              <MapsTab maps={p.maps} />
            </Tabs.Panel>
            <Tabs.Panel value="teammates">
              <TeammatesTab player={p} />
            </Tabs.Panel>
          </Tabs.Root>
        </div>

        <aside className="grid min-w-0 gap-4 *:min-w-0">
          <RanksCard ranks={p.ranks} />
          <CrosshairCard crosshair={p.crosshair} />
          <PartyCard party={p.party} />
          <SteamCard player={p} />
        </aside>
      </div>

      <ClipViewerDialog
        clipId={search.clip}
        source={{ kinds: [], steamId }}
        onSelect={(clip) =>
          navigate({
            search: (s) => ({ ...s, clip }),
            mask: clipMask(clip),
            replace: true,
            resetScroll: false,
          })
        }
        onClose={() => navigate({ search: (s) => ({ ...s, clip: undefined }), resetScroll: false })}
      />
    </div>
  )
}
