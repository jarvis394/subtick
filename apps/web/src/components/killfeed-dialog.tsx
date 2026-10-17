import { Dialog } from '@base-ui/react/dialog'
import { type Side, weaponName } from '@subtick/domain'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { mapPreviewUrl } from '@/components/map-icon'
import { clipLength } from '@/lib/format'
import { BLIND_ICON, type FeedEntry, modifierIcons, momentFeed, weaponIcon } from '@/lib/killfeed'
import type { MatchDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** The in-game killfeed colors, not the app's muted side tokens. */
const SIDE_COLOR: Record<Side, string> = { CT: 'text-[#8cb4f5]', T: 'text-[#eac15c]' }

const Name = ({ side, children }: { side: Side; children: ReactNode }) => (
  <span className={cn('max-w-[11rem] truncate', SIDE_COLOR[side])}>{children}</span>
)

/** One killfeed line, drawn like CS2's: red outline when the moment's player is involved. */
const FeedLine = ({ entry, own }: { entry: FeedEntry; own: boolean }) => {
  const icon = weaponIcon(entry.weapon)
  return (
    <div
      className={cn(
        'flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-sm',
        own ? 'bg-black/80 ring-2 ring-[#e0261f] ring-inset' : 'bg-black/60',
      )}
    >
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
    </div>
  )
}

/** A moment's kills as CS2 showed them: every kill of the round inside the clip window. */
export const KillfeedDialog = ({
  match,
  moment,
  subtitle,
  trigger,
}: {
  match: MatchDetail
  moment: { title: string; steamId: string; round: number; startTick: number; endTick: number }
  subtitle: string
  trigger: ReactNode
}) => {
  const feed = momentFeed(match, moment)
  const preview = mapPreviewUrl(match.match.map)

  return (
    <Dialog.Root>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-surface shadow-xl outline-none transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-serif text-xl tracking-tight">
                {moment.title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 truncate text-sm text-muted">
                {subtitle}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="relative isolate bg-[#0d0d0d]">
            {preview && (
              <img
                src={preview}
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover opacity-35 blur-[2px]"
              />
            )}
            <ol className="grid max-h-[60vh] gap-1.5 overflow-y-auto p-4">
              {feed.map((entry) => (
                <li
                  key={`${entry.tick}:${entry.victim.steamId}`}
                  className="flex min-w-0 items-center gap-3"
                >
                  <span className="w-8 shrink-0 font-mono text-[11px] text-white/60 tabular-nums">
                    {clipLength(moment.startTick, entry.tick)}
                  </span>
                  <FeedLine
                    entry={entry}
                    own={
                      entry.attacker?.steamId === moment.steamId ||
                      entry.victim.steamId === moment.steamId
                    }
                  />
                </li>
              ))}
              {feed.length === 0 && (
                <li className="py-6 text-center text-sm text-white/60">No kills in this moment.</li>
              )}
            </ol>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
