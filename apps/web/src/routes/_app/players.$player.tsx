import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { ClipViewerDialog } from '@/components/clip-viewer'
import { ErrorPage } from '@/components/error-page'
import { playerSlug } from '@/components/player-link'
import { MapsTab } from '@/components/profile/maps-tab'
import { MatchesTab } from '@/components/profile/matches-tab'
import { OverviewTab } from '@/components/profile/overview-tab'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileRail } from '@/components/profile/side-rail'
import { TeammatesTab } from '@/components/profile/teammates-tab'
import { Skeleton } from '@/components/ui/surface'
import { Tab, Tabs, TabsList, TabsPanel } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api'
import { clipMask, clipViewerSearch } from '@/lib/highlights'
import { playerQuery } from '@/lib/queries'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'maps', label: 'Maps' },
  { id: 'teammates', label: 'Teammates' },
] as const

type Tab = (typeof TABS)[number]['id']

export const Route = createFileRoute('/_app/players/$player')({
  head: () => ({ meta: [{ title: 'Player · subtick' }] }),
  validateSearch: clipViewerSearch.extend({
    tab: z.enum(TABS.map((t) => t.id) as [Tab, ...Tab[]]).optional(),
  }),
  // Profiles live at the vanity URL when there is one: swap a Steam ID (or a vanity in other casing) for it.
  loader: async ({ context: { queryClient }, params }) => {
    const player = await queryClient.ensureQueryData(playerQuery(params.player)).catch(() => null)
    const slug = player && playerSlug(player)
    if (!slug || slug === params.player) return
    queryClient.setQueryData(playerQuery(slug).queryKey, player)
    throw redirect({
      to: '/players/$player',
      params: { player: slug },
      search: true,
      replace: true,
    })
  },
  component: ProfilePage,
})

const ProfileSkeleton = () => (
  <div aria-hidden className="grid grid-cols-1 gap-8 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="@container min-w-0">
      <Skeleton className="-mx-4 -mt-6 aspect-[3/1] rounded-none md:mx-0 md:mt-0 md:rounded-t-2xl md:rounded-b-none @3xl:aspect-[4/1]" />
      <div className="flex items-start gap-5 px-4 md:px-6">
        <span className="relative -mt-12 flex rounded-full ring-4 ring-surface @2xl:-mt-16">
          <Skeleton className="size-24 rounded-full @2xl:size-32" />
        </span>
        <Skeleton className="mt-4 h-8 w-48 rounded" />
      </div>
    </div>
  </div>
)

function ProfilePage() {
  const params = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const player = useQuery(playerQuery(params.player))
  const tab = search.tab ?? 'overview'

  const setTab = (next: Tab) =>
    navigate({
      search: (s) => ({ ...s, tab: next === 'overview' ? undefined : next }),
      replace: true,
      resetScroll: false,
    })

  if (player.isError)
    return player.error instanceof ApiError && player.error.status === 404 ? (
      <ErrorPage />
    ) : (
      <p className="text-body text-danger">Couldn’t load this profile. Try reloading the page.</p>
    )
  if (!player.data) return <ProfileSkeleton />
  const p = player.data

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 @5xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:items-start">
        <div className="@container min-w-0">
          <ProfileHeader player={p} />
          <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="mt-6 min-w-0">
            <TabsList variant="segmented" aria-label="Profile" className="mb-6">
              {TABS.map((t) => (
                <Tab key={t.id} value={t.id}>
                  {t.label}
                </Tab>
              ))}
            </TabsList>
            <TabsPanel value="overview">
              <OverviewTab player={p} />
            </TabsPanel>
            <TabsPanel value="matches">
              <MatchesTab steamId={p.steamId} />
            </TabsPanel>
            <TabsPanel value="maps">
              <MapsTab maps={p.maps} />
            </TabsPanel>
            <TabsPanel value="teammates">
              <TeammatesTab player={p} />
            </TabsPanel>
          </Tabs>
        </div>

        <ProfileRail player={p} />
      </div>

      <ClipViewerDialog
        clipId={search.clip}
        source={{ kinds: [], steamId: p.steamId }}
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
