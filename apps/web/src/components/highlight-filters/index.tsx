import { mapName } from '@subtick/domain'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { User, Users, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { KindTabs } from '@/components/kind-tabs'
import { MapIcon } from '@/components/map-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FadeItem, FadeList, Presence } from '@/components/ui/presence'
import {
  type ClipListSearch,
  KILL_TAG_LABEL,
  MOMENT_TAG_LABEL,
  NO_FILTERS,
  toggled,
} from '@/lib/highlights'
import { clipFacetsQuery, meQuery } from '@/lib/queries'
import { DetailFilters } from './detail-filters'
import { PlayerPicker } from './player-picker'

type Patch = Partial<ClipListSearch>

/**
 * The feed's filter bar, then the picks it hides behind its dropdowns as chips that remove them.
 * On a profile (`steamId`) the player is fixed, so there's no player picker.
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
  const byId = new Map(facets.data?.players.map((p) => [p.steamId, p]))
  const picks: { key: string; label: string; icon?: ReactNode; patch: Patch }[] = [
    ...(steamId
      ? []
      : [
          ...(search.me
            ? [{ key: 'me', label: 'Me', icon: <User />, patch: { me: undefined } }]
            : []),
          ...(search.playedWith
            ? [
                {
                  key: 'with',
                  label: 'People I played with',
                  icon: <Users />,
                  patch: { playedWith: undefined },
                },
              ]
            : []),
          ...(search.players ?? []).map((id) => ({
            key: `player:${id}`,
            label: byId.get(id)?.name ?? 'Unknown player',
            icon: (
              <Avatar
                src={byId.get(id)?.avatarUrl}
                name={byId.get(id)?.name ?? '?'}
                className="-ml-1.5 size-5 text-micro"
              />
            ),
            patch: { players: toggled(search.players, id) },
          })),
        ]),
    ...(search.tags ?? []).map((tag) => ({
      key: `tag:${tag}`,
      label: KILL_TAG_LABEL[tag],
      patch: { tags: toggled(search.tags, tag) },
    })),
    ...(search.moments ?? []).map((tag) => ({
      key: `moment:${tag}`,
      label: MOMENT_TAG_LABEL[tag],
      patch: { moments: toggled(search.moments, tag) },
    })),
    ...(search.clutch ?? []).map((n) => ({
      key: `clutch:${n}`,
      label: `1v${n}`,
      patch: { clutch: toggled(search.clutch, n) },
    })),
    ...(search.maps ?? []).map((map) => ({
      key: `map:${map}`,
      label: mapName(map),
      icon: <MapIcon map={map} className="-ml-1 size-4 rounded-sm text-micro" />,
      patch: { maps: toggled(search.maps, map) },
    })),
  ]

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
              mySteamIds={me.steamLinks.map((link) => link.steamId)}
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
      {/* Eases open and shut, and chips fade in and out, like the queue's items. */}
      <Presence show={picks.length > 0}>
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <FadeList>
            {picks.map((pick) => (
              <FadeItem key={pick.key}>
                <Chip
                  pressed
                  aria-label={`Remove ${pick.label}`}
                  onPressedChange={() => onChange(pick.patch)}
                >
                  {pick.icon}
                  {pick.label}
                  <X />
                </Chip>
              </FadeItem>
            ))}
            <FadeItem key="clear">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onChange({ ...NO_FILTERS, kind: search.kind })}
              >
                Clear all
              </Button>
            </FadeItem>
          </FadeList>
        </div>
      </Presence>
    </div>
  )
}
