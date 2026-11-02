import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Clapperboard, Search, User, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import type { ClipListSearch } from '@/lib/highlights'
import type { ClipFacets } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { itemClass, popupClass, triggerClass } from './styles'

const ME = '__me'
const PLAYED_WITH = '__played_with'

type PlayerSearch = Pick<ClipListSearch, 'players' | 'me' | 'playedWith'>

const labelOf = (id: string, byId: Map<string, { name: string }>) =>
  id === ME
    ? 'Me'
    : id === PLAYED_WITH
      ? 'People I played with'
      : (byId.get(id)?.name ?? 'Unknown player')

/** Who made the play: the viewer, people they played with, or anyone picked from the list. */
export const PlayerPicker = ({
  players,
  search,
  onChange,
  className,
}: {
  players: ClipFacets['players']
  search: PlayerSearch
  onChange: (patch: PlayerSearch) => void
  /** Layout for the trigger, e.g. joining it to its neighbour. */
  className?: string
}) => {
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const byId = new Map(players.map((p) => [p.steamId, p]))
  const groups = [
    { label: 'You', items: [ME, PLAYED_WITH] },
    { label: 'Players', items: players.map((p) => p.steamId) },
  ]
  const value = [
    ...(search.me ? [ME] : []),
    ...(search.playedWith ? [PLAYED_WITH] : []),
    ...(search.players ?? []),
  ]
  const summary =
    value.length === 0
      ? 'All players'
      : value.length === 1
        ? labelOf(value[0]!, byId)
        : `${value.length} selected`
  const only = value.length === 1 ? value[0]! : undefined
  const onlyPlayer = only ? byId.get(only) : undefined

  return (
    <Combobox.Root
      multiple
      items={groups}
      value={value}
      itemToStringLabel={(id) => labelOf(id, byId)}
      onValueChange={(next) => {
        const picked = next.filter((id) => id !== ME && id !== PLAYED_WITH)
        onChange({
          me: next.includes(ME) || undefined,
          playedWith: next.includes(PLAYED_WITH) || undefined,
          players: picked.length ? picked : undefined,
        })
        setOpen(false)
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <Combobox.Trigger className={cn(triggerClass, 'max-w-60 min-w-36', className)}>
        {onlyPlayer ? (
          <Avatar
            src={onlyPlayer.avatarUrl}
            name={onlyPlayer.name}
            className="-ml-1 size-5 text-micro"
          />
        ) : only === ME ? (
          <User className="size-4 shrink-0 text-muted" />
        ) : (
          <Users className="size-4 shrink-0 text-muted" />
        )}
        <span className="flex-1 truncate text-left">{summary}</span>
        <Combobox.Icon>
          <ChevronDown className="size-4 text-muted" />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} align="start" className="z-50">
          <Combobox.Popup
            aria-label="Players"
            // Base UI focuses the input before the popup is positioned, scrolling the page to it.
            initialFocus={() => {
              input.current?.focus({ preventScroll: true })

              return false
            }}
            className={cn(popupClass, 'w-72')}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted" />
              <Combobox.Input
                ref={input}
                placeholder="Search players"
                className="h-10 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
              />
            </div>
            <Combobox.Empty className="px-3 py-4 text-body text-muted empty:hidden">
              No players found
            </Combobox.Empty>
            <Combobox.List className="max-h-80 scroll-py-1 overflow-auto overscroll-contain p-1 empty:hidden">
              {(group: (typeof groups)[number]) => (
                <Combobox.Group key={group.label} items={group.items} className="pb-1 last:pb-0">
                  <Combobox.GroupLabel className="px-2 pt-2 pb-1 text-caption font-medium text-muted">
                    {group.label}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(id: string) => {
                      const player = byId.get(id)

                      return (
                        <Combobox.Item key={id} value={id} className={itemClass}>
                          {player ? (
                            <Avatar src={player.avatarUrl} name={player.name} className="size-6" />
                          ) : (
                            <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-muted">
                              {id === ME ? (
                                <User className="size-3.5" />
                              ) : (
                                <Users className="size-3.5" />
                              )}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate">{labelOf(id, byId)}</span>
                          {player && (
                            <span className="inline-flex items-center gap-1 text-small text-muted tabular-nums">
                              <Clapperboard aria-hidden className="size-3.5" />
                              <span className="sr-only">Clips:</span>
                              {player.clips}
                            </span>
                          )}
                          <span className="grid size-4 place-items-center">
                            <Combobox.ItemIndicator>
                              <Check className="size-4 text-accent" />
                            </Combobox.ItemIndicator>
                          </span>
                        </Combobox.Item>
                      )
                    }}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
