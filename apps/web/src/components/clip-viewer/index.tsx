import { Dialog } from '@base-ui/react/dialog'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ErrorPage } from '@/components/error-page'
import { IconButton } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useStableCallback } from '@/hooks/use-stable-callback'
import { ApiError } from '@/lib/api'
import { clipQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CONTENT_INSET, Player, VIDEO_FRAME } from './player'
import { Reel } from './reel'
import { type ReelClip, type ReelSource, recorded, useReel } from './use-reel'

export type { ReelSource } from './use-reel'

/**
 * The first value seen for `key`, held until the key changes. Clip lists refetch on every pipeline
 * event and come back with freshly presigned URLs; swapping the `<video>` src would restart it.
 */
const useHeld = <T,>(key: string, value: T | undefined) => {
  const [held, setHeld] = useState<{ key: string; value: T } | null>(null)
  if (value !== undefined && held?.key !== key) setHeld({ key, value })

  return held?.key === key ? held.value : value
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * A recorded clip over the page it was opened from, with the rest of that page's clips in a reel
 * beside it. Open while `clipId` is set; the page keeps it in the URL so the view can be shared.
 */
export const ClipViewerDialog = ({
  clipId,
  source,
  onSelect,
  onClose,
}: {
  clipId: string | undefined
  source: ReelSource
  /** Switch to another clip (from the reel, the up-next card or the keyboard). */
  onSelect: (id: string) => void
  onClose: () => void
}) => {
  // Keep showing the last clip while the dialog animates out.
  const [shownId, setShownId] = useState(clipId)
  if (clipId && clipId !== shownId) setShownId(clipId)

  return (
    <Dialog.Root open={Boolean(clipId)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="vt-modal fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* Base UI's outside-scroll layout: the page stays locked, and the viewport scrolls the
          dialog, which can run past the bottom of the screen. */}
        <Dialog.Viewport className="group/dialog vt-modal fixed inset-0 z-50">
          <ScrollArea.Root
            style={{ position: undefined }}
            className="h-full group-data-ending-style/dialog:pointer-events-none"
          >
            <ScrollArea.Viewport className="h-full overscroll-contain outline-none group-data-ending-style/dialog:pointer-events-none">
              <ScrollArea.Content className="min-h-full md:px-16 md:pt-12 md:pb-6">
                <Dialog.Popup
                  className={cn(
                    'relative min-h-dvh bg-background outline-none md:min-h-0 md:overflow-clip md:rounded-2xl md:border md:shadow-2xl lg:mx-auto lg:max-w-7xl',
                    'transition-[opacity,scale] duration-200 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
                    'motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100',
                  )}
                >
                  {/* Stays at the top of the screen while the dialog scrolls under it. */}
                  <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background pr-2.5 pl-4 md:hidden">
                    <span className="text-lead font-medium">Highlights</span>
                    <CloseButton />
                  </header>
                  {shownId && (
                    <ClipViewer
                      id={shownId}
                      source={source}
                      onSelect={onSelect}
                      onClose={onClose}
                    />
                  )}
                </Dialog.Popup>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="z-20 my-1 mr-1 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0"
            >
              <ScrollArea.Thumb className="w-full rounded-full bg-foreground/25" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
          {/* From md up beside the card's top corner, on the backdrop, and held there while the
            dialog scrolls: outside the scroll area. Lines up with the card's right edge, which
            stops moving once the card reaches its max width (80rem plus the 4rem side margins). */}
          <CloseButton className="absolute top-12 right-[calc(1rem+max(0px,(100vw-88rem)/2))] transition-[color,opacity] group-data-ending-style/dialog:opacity-0 group-data-starting-style/dialog:opacity-0 max-md:hidden md:after:-inset-3 md:[--bg-hover:transparent]" />
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The pseudo-element is a hit margin so a slightly-off tap still closes: 10px, which fills the
 * phone's 56px bar exactly, and ends at the screen edge (the bar's right padding is 10px too).
 */
const CloseButton = ({ className }: { className?: string }) => (
  <Dialog.Close
    render={
      <IconButton
        label="Close"
        tooltip={false}
        className={cn('after:absolute after:-inset-2.5', className)}
      />
    }
  >
    <X />
  </Dialog.Close>
)

/**
 * The player and its reel. Inside the dialog when `onClose` is given; otherwise laid out as the
 * `/clips/$id` page, which is what a clip's URL opens when loaded directly.
 */
export const ClipViewer = ({
  id,
  source,
  onSelect,
  onClose,
}: {
  id: string
  source: ReelSource
  onSelect: (id: string) => void
  onClose?: () => void
}) => {
  const modal = Boolean(onClose)
  const reel = useReel(source)
  const [autoplay, setAutoplay] = useLocalStorage('subtick:clip-autoplay', true)

  const index = reel.items.findIndex((c) => c.id === id)
  const fromReel = index === -1 ? undefined : reel.items[index]
  // A shared link opens before (or outside of) the reel, so fetch the clip itself then.
  const single = useQuery({ ...clipQuery(id), enabled: !reel.isPending && !fromReel })
  const fetched = single.data && recorded(single.data) ? single.data : undefined
  const current = useHeld(id, fromReel ?? fetched)

  const prev = index > 0 ? reel.items[index - 1] : undefined
  const next = index === -1 ? undefined : reel.items[index + 1]

  // Keep the reel one page ahead of the clip playing.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reel
  const nearEnd = index !== -1 && index >= reel.items.length - 2

  const go = (clip: ReelClip | undefined) => clip && onSelect(clip.id)

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- autoplay, keys and clicks all move the clip, so the reel's paging follows the position
  useEffect(() => {
    if (nearEnd && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [nearEnd, hasNextPage, isFetchingNextPage, fetchNextPage])

  const goPrev = useStableCallback(() => go(prev))
  const goNext = useStableCallback(() => go(next))
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- window keydown listener for reel navigation while mounted
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key === 'ArrowDown' || e.key === 'j') goNext()
      else if (e.key === 'ArrowUp' || e.key === 'k') goPrev()
      else return
      e.preventDefault()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  const position =
    index === -1
      ? undefined
      : `${index + 1} / ${reel.items.length}${reel.isFetchingNextPage ? '+' : ''}`

  const reelPanel = (
    <Reel
      reel={reel}
      activeId={id}
      position={position}
      isMatch={'match' in source}
      modal={modal}
      autoplay={autoplay}
      onAutoplayChange={setAutoplay}
      upNextId={autoplay ? next?.id : undefined}
      onSelect={onSelect}
      onPrev={prev && (() => go(prev))}
      onNext={next && (() => go(next))}
    />
  )

  const missing =
    !current &&
    (single.error instanceof ApiError ? single.error.status === 404 : single.isSuccess && !fetched)

  return (
    <div className={cn('grid lg:grid-cols-[minmax(0,1fr)_22rem]', !modal && 'lg:gap-x-8')}>
      {/* Below lg the column (and the player in it) dissolves into the grid, so the video is a
        grid item of its own and can stay stuck at the top while the reel scrolls under it. */}
      <div className={cn('min-w-0 max-lg:contents', modal && 'lg:pb-6')}>
        {!modal && !missing && (
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 rounded-md text-body text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" /> Highlights
          </Link>
        )}

        {missing ? (
          <ErrorPage
            title="Clip not found"
            description="It may not have been recorded yet, or the link is wrong."
            className="min-h-80"
            onBack={onClose}
          />
        ) : current ? (
          <Player
            clip={current}
            next={next}
            autoplay={autoplay}
            onAutoplayChange={setAutoplay}
            onNext={() => go(next)}
            modal={modal}
            onClose={onClose}
          />
        ) : (
          <div>
            <Skeleton className={cn('aspect-video', modal && VIDEO_FRAME)} />
            <div className={cn(modal && CONTENT_INSET)}>
              <Skeleton className="mt-5 h-7 w-2/3 rounded-lg" />
              <Skeleton className="mt-3 h-5 w-1/2 rounded-lg" />
            </div>
          </div>
        )}
      </div>

      {/* In the dialog the reel is laid over this box, so the player column alone sets the
        height it scrolls in. (On the clip page it's sticky instead, which a wrapper would break.) */}
      {modal ? <div className="relative min-w-0">{reelPanel}</div> : reelPanel}
    </div>
  )
}
