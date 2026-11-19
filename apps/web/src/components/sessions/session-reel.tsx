import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import { HighlightCard } from '@/components/highlight-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/surface'
import { clipMask } from '@/lib/highlights'
import { type ClipFilters, clipsQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'

const PREVIEW = 4

/** Two on phones, three in a mid column, four when there's room, so a row never ends half full. */
const slot = (i: number) => cn(i >= 2 && 'hidden @xl:block', i >= 3 && '@xl:hidden @5xl:block')

/**
 * The best few of one player's clips from the session; the rest play on in the viewer. Nothing
 * when they have none.
 */
export const SessionReel = ({
  filters,
  count,
  onOpen,
}: {
  filters: ClipFilters & { kinds: [] }
  count: number
  /** Before the viewer opens, so its up-next plays this session's clips. */
  onOpen: () => void
}) => {
  const root = useRef<HTMLElement>(null)
  const near = useInView(root, { once: true, margin: '400px' })
  const clips = useInfiniteQuery({ ...clipsQuery(filters), enabled: near && count > 0 })
  const items = (clips.data?.pages[0]?.items ?? []).slice(0, PREVIEW)
  const navigate = useNavigate()

  if (count === 0) return null

  const openAll = () => {
    const first = items[0]
    if (!first) return
    onOpen()
    void navigate({
      to: '.',
      search: (s) => ({ ...s, clip: first.id }),
      mask: clipMask(first.id),
      resetScroll: false,
    })
  }

  return (
    <section ref={root} className="pb-2">
      <div className="mb-3 flex h-8 items-center justify-between gap-4">
        <h3 className="text-body font-medium">
          Clips <span className="font-normal text-muted tabular-nums">{count}</span>
        </h3>
        {count > 2 && (
          <Button size="sm" variant="ghost" onClick={openAll} disabled={!items.length}>
            Show all <ChevronRight />
          </Button>
        )}
      </div>
      <div
        className="grid grid-cols-1 gap-x-5 gap-y-6 @xl:grid-cols-3 @5xl:grid-cols-4"
        onClickCapture={onOpen}
      >
        {items.length
          ? items.map((clip, i) =>
              clip.clip ? (
                <div key={clip.id} className={slot(i)}>
                  <HighlightCard highlight={{ ...clip, clip: clip.clip }} player={clip.player} />
                </div>
              ) : null,
            )
          : Array.from({ length: Math.min(count, PREVIEW) }, (_, i) => (
              <div key={i} className={slot(i)}>
                <Skeleton className="aspect-video" />
                <Skeleton className="mt-3 h-12" />
              </div>
            ))}
      </div>
    </section>
  )
}
