import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { KindTabs } from '@/components/kind-tabs'
import type { ClipListSearch } from '@/lib/highlights'
import { accountsQuery, clipFacetsQuery, meQuery } from '@/lib/queries'
import { DetailFilters } from './detail-filters'
import { PlayerPicker } from './player-picker'

type Patch = Partial<ClipListSearch>

/**
 * The feed's filter bar. On a profile (`steamId`) the player is fixed, so there's no player picker.
 */
export const HighlightFilters = ({
  search,
  steamId,
  onChange,
}: {
  search: ClipListSearch
  steamId?: string
  onChange: (patch: Patch) => void
}) => {
  const facets = useQuery(clipFacetsQuery(steamId))
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: accounts = [] } = useQuery(accountsQuery)
  // Every account's players count as "me"; before the list loads, the active account's.
  const mySteamIds = accounts.length
    ? accounts.flatMap((a) => a.steamIds)
    : me.steamLinks.map((link) => link.steamId)

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2">
        <KindTabs
          value={search.kind ?? 'all'}
          onChange={(value) => onChange({ kind: value === 'all' ? undefined : value })}
        />
        {/* One split control: who, then everything else. */}
        <div className="flex">
          {!steamId && (
            <PlayerPicker
              players={facets.data?.players ?? []}
              mySteamIds={mySteamIds}
              accounts={accounts.filter((a) => !a.pending)}
              search={search}
              onChange={onChange}
              className="rounded-r-none"
            />
          )}
          <DetailFilters
            facets={facets.data}
            search={search}
            onChange={onChange}
            className={steamId ? undefined : 'rounded-l-none border-l-0'}
          />
        </div>
      </div>
    </div>
  )
}
