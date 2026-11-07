import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Clapperboard, Component, Search, User, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Sheet } from '@/components/ui/sheet'
import { useHandheld } from '@/hooks/use-handheld'
import type { PlayerSearch } from '@/lib/highlights'
import { cn } from '@/lib/utils'
import { itemClass, popupClass, sheetItemClass, triggerClass } from './styles'
import { type SummaryToken, TriggerSummary } from './trigger-summary'

/** Avatars the trigger shows for a multiple pick before folding the rest into "+n". */
const STACKED = 2
const ME = '__me'
const PLAYED_WITH = '__played_with'
const ALL = '__all'

interface PickerPlayer {
  steamId: string
  name: string
  avatarUrl: string | null
  clips: number
}

/**
 * Who made the play: the viewer, people they played with, or anyone picked from the list. The
 * viewer's own accounts (`mySteamIds`) show under You as "Me" rather than among the players.
 */
export const PlayerPicker = ({
  players,
  mySteamIds,
  playedWith = true,
  countLabel = 'Clips',
  align = 'start',
  search,
  onChange,
  className,
}: {
  players: PickerPlayer[]
  mySteamIds: string[]
  /** Offers "People I played with"; a match page has it only when the viewer queued with others. */
  playedWith?: boolean
  /** What the number beside each player counts, for screen readers. */
  countLabel?: string
  /** Which edge of the trigger the list lines up with: the side of the page it sits on. */
  align?: 'start' | 'end'
  search: PlayerSearch
  onChange: (patch: PlayerSearch) => void
  /** Layout for the trigger, e.g. joining it to its neighbour. */
  className?: string
}) => {
  const sheet = useHandheld()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const byId = new Map(players.map((p) => [p.steamId, p]))
  const mine = players.filter((p) => mySteamIds.includes(p.steamId))
  const meRow = mine[0] && { ...mine[0], clips: mine.reduce((n, p) => n + p.clips, 0) }
  // All players heads the list on its own, without a section label.
  const groups = [
    { label: '', items: [ALL] },
    { label: 'You', items: [ME, ...(playedWith ? [PLAYED_WITH] : [])] },
    {
      label: 'Players',
      items: players.filter((p) => !mySteamIds.includes(p.steamId)).map((p) => p.steamId),
    },
  ].filter((group) => group.items.length > 0)
  const value = [
    ...(search.me ? [ME] : []),
    ...(search.playedWith && playedWith ? [PLAYED_WITH] : []),
    ...(search.players ?? []),
  ]
  const only = value.length === 1 ? value[0]! : undefined
  // What the list checks: All players stands for an empty pick.
  const checked = value.length ? value : [ALL]
  const tokens: SummaryToken[] =
    value.length === 0
      ? [{ key: 'all', icon: 'users' }]
      : only === PLAYED_WITH
        ? [{ key: PLAYED_WITH, icon: 'group' }]
        : only === ME && !meRow
          ? [{ key: ME, icon: 'user' }]
          : [
              ...value.slice(0, STACKED).map((id): SummaryToken => {
                const player = id === ME ? meRow : byId.get(id)

                return player
                  ? { key: id, avatar: { src: player.avatarUrl, name: player.name } }
                  : { key: id, group: true }
              }),
              ...(value.length > STACKED ? [{ key: 'more', more: value.length - STACKED }] : []),
            ]

  const triggerClassName = cn(triggerClass, 'group/trigger max-w-60 min-w-36', className)

  const labelOf = (id: string) =>
    id === ALL
      ? 'All players'
      : id === ME
        ? (meRow?.name ?? 'Me')
        : id === PLAYED_WITH
          ? 'People I played with'
          : (byId.get(id)?.name ?? 'Unknown player')

  const pick = (choice: string[]) => {
    // All players clears the pick; a You pick stands alone, replacing everything else.
    const added = choice.find((id) => !checked.includes(id))
    let next = choice.filter((id) => id !== ALL)
    if (added === ALL) next = []
    else if (added === ME || added === PLAYED_WITH) next = [added]
    const picked = next.filter((id) => id !== ME && id !== PLAYED_WITH)
    onChange({
      me: next.includes(ME) || undefined,
      playedWith: next.includes(PLAYED_WITH) || undefined,
      players: picked.length ? picked : undefined,
    })
    setOpen(false)
  }

  const list = (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b',
          sheet ? 'sticky top-0 z-10 bg-surface px-5' : 'px-3',
        )}
      >
        <Search className="size-4 shrink-0 text-muted" />
        <Combobox.Input
          ref={input}
          placeholder="Search players"
          className={cn(
            'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted',
            sheet ? 'h-14 text-lead' : 'h-10 text-body',
          )}
        />
      </div>
      <Combobox.Empty
        className={cn('py-4 text-body text-muted empty:hidden', sheet ? 'px-5' : 'px-3')}
      >
        No players found
      </Combobox.Empty>
      <Combobox.List
        className={cn(
          'min-h-0 empty:hidden',
          sheet ? 'p-2' : 'max-h-80 scroll-py-1 overflow-auto overscroll-contain p-1',
        )}
      >
        {(group: (typeof groups)[number]) => (
          <Combobox.Group key={group.label || ALL} items={group.items} className="pb-1 last:pb-0">
            {group.label && (
              <Combobox.GroupLabel
                className={cn(
                  'pt-2 pb-1 text-caption font-medium text-muted',
                  sheet ? 'px-3' : 'px-2',
                )}
              >
                {group.label}
              </Combobox.GroupLabel>
            )}
            <Combobox.Collection>
              {(id: string) => {
                const player = id === ME ? meRow : byId.get(id)

                return (
                  <Combobox.Item key={id} value={id} className={sheet ? sheetItemClass : itemClass}>
                    {player ? (
                      <Avatar src={player.avatarUrl} name={player.name} className="size-6" />
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-muted">
                        {id === ME ? (
                          <User className="size-3.5" />
                        ) : id === PLAYED_WITH ? (
                          <Component className="size-3.5" />
                        ) : (
                          <Users className="size-3.5" />
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{labelOf(id)}</span>
                    {player && (
                      <span className="inline-flex items-center gap-1 text-small text-muted tabular-nums">
                        <Clapperboard aria-hidden className="size-3.5" />
                        <span className="sr-only">{countLabel}:</span>
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
    </>
  )

  if (sheet) {
    return (
      <Sheet
        title="Players"
        open={open}
        onOpenChange={setOpen}
        className="p-0"
        trigger={
          <button type="button" className={triggerClassName}>
            <TriggerSummary
              tokens={tokens}
              label={
                value.length === 0
                  ? 'All players'
                  : only
                    ? labelOf(only)
                    : `${value.length} selected`
              }
              me={only === ME && Boolean(meRow)}
            />
            <ChevronDown className="size-4 text-muted" />
          </button>
        }
      >
        <Combobox.Root
          inline
          multiple
          items={groups}
          value={checked}
          itemToStringLabel={labelOf}
          onValueChange={pick}
          // Stays open while the sheet slides away, so the list doesn't collapse mid-close; the
          // sheet unmounts it afterwards, which resets the search.
          open
          onOpenChange={(next) => !next && setOpen(false)}
        >
          {list}
        </Combobox.Root>
      </Sheet>
    )
  }

  return (
    <Combobox.Root
      multiple
      items={groups}
      value={checked}
      itemToStringLabel={labelOf}
      onValueChange={pick}
      open={open}
      onOpenChange={setOpen}
    >
      <Combobox.Trigger className={triggerClassName}>
        <TriggerSummary
          tokens={tokens}
          label={
            value.length === 0 ? 'All players' : only ? labelOf(only) : `${value.length} selected`
          }
          me={only === ME && Boolean(meRow)}
        />
        <Combobox.Icon>
          <ChevronDown className="size-4 text-muted" />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} align={align} className="z-50">
          <Combobox.Popup
            aria-label="Players"
            // Base UI focuses the input before the popup is positioned, scrolling the page to it.
            initialFocus={() => {
              input.current?.focus({ preventScroll: true })

              return false
            }}
            className={cn(
              popupClass,
              'flex max-h-(--available-height) w-[min(18rem,var(--available-width))] flex-col',
            )}
          >
            {list}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
