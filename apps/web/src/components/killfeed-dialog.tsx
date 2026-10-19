import { Dialog } from '@base-ui/react/dialog'
import { type ClipSegment, type Side, weaponName } from '@subtick/domain'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HighlightPlayer } from '@/components/highlight-card'
import { mapPreviewUrl } from '@/components/map-icon'
import { Avatar } from '@/components/ui/avatar'
import { IconButton } from '@/components/ui/button'
import { clipTime } from '@/lib/format'
import {
  BLIND_ICON,
  BOMB_EXPLODED_ICON,
  BOMB_ICON,
  type BombEntry,
  DEFUSE_ICON,
  type FeedEntry,
  type KillEntry,
  modifierIcons,
  momentFeed,
  weaponIcon,
} from '@/lib/killfeed'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** The in-game killfeed colors, not the app's muted side tokens. */
const SIDE_COLOR: Record<Side, string> = { CT: 'text-[#8cb4f5]', T: 'text-[#eac15c]' }

const Name = ({ side, children }: { side: Side; children: ReactNode }) => (
  <span className={cn('max-w-[11rem] truncate', SIDE_COLOR[side])}>{children}</span>
)

/** How a line involves the moment's player: something they did, or their death. */
type Own = 'action' | 'death' | null

/**
 * A killfeed line's box, drawn like CS2's: red outline for the moment's player's own kills and
 * bomb events, a faint red fill for their death.
 */
const Line = ({ own, children }: { own: Own; children: ReactNode }) => (
  <div
    className={cn(
      'flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-sm',
      own === 'action'
        ? 'bg-black/80 ring-2 ring-[#e0261f] ring-inset'
        : own === 'death'
          ? 'bg-[#e0261f]/35'
          : 'bg-black/60',
    )}
  >
    {children}
  </div>
)

const BOMB: Record<BombEntry['type'], { icon: string; text: string }> = {
  planted: { icon: BOMB_ICON, text: 'planted the bomb' },
  defused: { icon: DEFUSE_ICON, text: 'defused the bomb' },
  exploded: { icon: BOMB_EXPLODED_ICON, text: 'Bomb exploded' },
}

const BombLine = ({ entry, own }: { entry: BombEntry; own: Own }) => {
  const { icon, text } = BOMB[entry.type]
  return (
    <Line own={own}>
      <img src={icon} alt="" className="h-[18px]" />
      {entry.player && <Name side={entry.player.side}>{entry.player.name}</Name>}
      <span className="text-white/80">{text}</span>
    </Line>
  )
}

const KillLine = ({ entry, own }: { entry: KillEntry; own: Own }) => {
  const icon = weaponIcon(entry.weapon)
  return (
    <Line own={own}>
      {entry.attacker && entry.attacker.steamId !== entry.victim.steamId && (
        <>
          {entry.tags.includes('blind') && (
            <img src={BLIND_ICON} alt="Blind" title="Blind" className="h-[18px]" />
          )}
          <Name side={entry.attacker.side}>{entry.attacker.name}</Name>
          {entry.assister && (
            <>
              <span className="text-white/80">+</span>
              <Name side={entry.assister.side}>{entry.assister.name}</Name>
            </>
          )}
        </>
      )}
      {icon ? (
        <img
          src={icon}
          alt={weaponName(entry.weapon)}
          title={weaponName(entry.weapon)}
          className="mx-1 h-[18px] w-auto"
        />
      ) : (
        <span className="mx-1 text-white/80">{weaponName(entry.weapon)}</span>
      )}
      {modifierIcons(entry.tags).map(({ tag, src }) => (
        <img key={tag} src={src} alt={tag} title={tag} className="-ml-0.5 h-[18px]" />
      ))}
      <Name side={entry.victim.side}>{entry.victim.name}</Name>
    </Line>
  )
}

const involves = (entry: FeedEntry, steamId: string): Own => {
  if (entry.type !== 'kill') return entry.player?.steamId === steamId ? 'action' : null
  if (entry.victim.steamId === steamId) return 'death'
  return entry.attacker?.steamId === steamId ? 'action' : null
}

/** A moment's killfeed as CS2 showed it: every kill and bomb event of the round inside the clip. */
export const KillfeedDialog = ({
  match,
  moment,
  player,
  subtitle,
  trigger,
  footer,
  onClosed,
}: {
  match: MatchDetail
  moment: {
    title: string
    steamId: string
    round: number
    startTick: number
    endTick: number
    segments: ClipSegment[]
  }
  /** Whose moment it is. */
  player: HighlightPlayer
  subtitle: string
  trigger: ReactNode
  /** Actions under the feed (cancel or retry a queued clip). */
  footer?: ReactNode
  /** Called once the dialog has finished closing (its exit animation done). */
  onClosed?: () => void
}) => {
  const feed = momentFeed(match, moment)
  const preview = mapPreviewUrl(match.match.map)

  return (
    <Dialog.Root onOpenChangeComplete={(open) => !open && onClosed?.()}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-surface shadow-xl outline-none transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={player.avatarUrl} name={player.name} className="size-10" />
              <div className="min-w-0">
                <Dialog.Title className="truncate text-base font-semibold">
                  {moment.title}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate text-[13px] text-muted">
                  <span className="text-foreground/80">{player.name}</span> · {subtitle}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              render={
                <IconButton size="sm" label="Close" tooltip={false} className="-mt-1 -mr-1" />
              }
            >
              <X />
            </Dialog.Close>
          </div>
          <div className="relative isolate overflow-hidden bg-[#0d0d0d]">
            {preview && (
              <img
                src={preview}
                alt=""
                // Scaled past the edges: a blur fades an image's own edges to transparent.
                className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-35 blur-[2px]"
              />
            )}
            <ol className="grid max-h-[60vh] gap-1.5 overflow-y-auto p-4">
              {feed.map((entry) => (
                <li
                  key={`${entry.tick}:${entry.type === 'kill' ? entry.victim.steamId : entry.type}`}
                  className="flex min-w-0 items-center gap-3"
                >
                  <span className="w-8 shrink-0 font-mono text-[11px] text-white/60 tabular-nums">
                    {clipTime(moment, entry.tick)}
                  </span>
                  {entry.type === 'kill' ? (
                    <KillLine entry={entry} own={involves(entry, moment.steamId)} />
                  ) : (
                    <BombLine entry={entry} own={involves(entry, moment.steamId)} />
                  )}
                </li>
              ))}
              {feed.length === 0 && (
                <li className="py-6 text-center text-sm text-white/60">
                  Nothing happened in this moment.
                </li>
              )}
            </ol>
          </div>
          {footer && (
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
