import { mapName } from '@subtick/domain'
import { Link, useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { type ComponentProps, memo, useRef, useState } from 'react'
import { PlayerAvatarLink, PlayerLink } from '@/components/player-link'
import { RoundMoment } from '@/components/round-moment'
import { FadeImage } from '@/components/ui/fade-image'
import { Badge } from '@/components/ui/surface'
import { clipSeconds, clock } from '@/lib/format'
import { KIND_LABEL, clipMask, tagSummary } from '@/lib/highlights'
import type { Clip } from '@/lib/queries'
import { cn } from '@/lib/utils'

type ClipCardData = Pick<
  Clip,
  | 'id'
  | 'matchId'
  | 'steamId'
  | 'kind'
  | 'title'
  | 'round'
  | 'startTick'
  | 'endTick'
  | 'segments'
  | 'kills'
> & {
  clip: NonNullable<Clip['clip']>
  map?: string | null
}

export interface HighlightPlayer {
  name: string
  avatarUrl: string | null
}

/** Kinds rare enough to stand out in the feed: their badge is black on white. */
const RARE = new Set<ClipCardData['kind']>(['ace', 'clutch'])

const shallowEqual = <T extends object>(a: T, b: T) => {
  const keys = Object.keys(a) as (keyof T)[]
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]))
}

/**
 * Opens the clip in the page's viewer. A plain anchor rather than a router `Link`: a Link rebuilds
 * its location (and the mask's) on mount and on every URL change, which across a page of cards
 * is most of the cost of rendering it. The href is the clip's own page, as the mask makes it.
 */
const ClipLink = ({
  id,
  onClick,
  ...props
}: { id: string } & Omit<ComponentProps<'a'>, 'href'>) => {
  const navigate = useNavigate()
  return (
    <a
      href={`/clips/${id}`}
      onClick={(e) => {
        onClick?.(e)
        // New tab, new window, download: the browser's, to the clip's page.
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return
        e.preventDefault()
        void navigate({
          to: '.',
          search: (s) => ({ ...s, clip: id }),
          mask: clipMask(id),
          resetScroll: false,
        })
      }}
      {...props}
    />
  )
}

/**
 * A recorded highlight: thumbnail that plays on hover and opens the viewer (the page's `clip`
 * search param), then who made it and where.
 * Memoized on the *contents* of its props: callers build `highlight`/`player` objects inline, so
 * reference equality would never hit and every card would re-render with its parent.
 */
export const HighlightCard = memo(
  function HighlightCard({
    highlight,
    player,
    context,
  }: {
    highlight: ClipCardData
    player: HighlightPlayer
    /** Replaces the "<map> ·" link before "Round <n>" when set, e.g. on the match's own page. */
    context?: string
  }) {
    const video = useRef<HTMLVideoElement>(null)
    const [playing, setPlaying] = useState(false)
    const total = clipSeconds(highlight)
    const [elapsed, setElapsed] = useState(0)
    const tags = tagSummary(highlight.kills)

    return (
      <article>
        <ClipLink
          id={highlight.id}
          aria-label={`Watch ${highlight.title}`}
          // Otherwise a drag on the thumbnail drags the link out instead.
          draggable={false}
          className="group/thumb relative block aspect-video overflow-hidden rounded-xl bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onMouseEnter={() => void video.current?.play().catch(() => {})}
          onMouseLeave={() => {
            const el = video.current
            if (!el) return
            el.pause()
            el.currentTime = 0
            setElapsed(0)
          }}
        >
          <FadeImage
            src={highlight.clip.thumbnailUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          {/* Hidden until it actually plays, so the thumbnail shows before and after a hover
            rather than the video's blank or first frame. */}
          <video
            ref={video}
            src={highlight.clip.videoUrl}
            preload="none"
            muted
            loop
            playsInline
            onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className={cn(
              'relative size-full object-cover transition-opacity duration-150',
              playing ? 'opacity-100' : 'opacity-0',
            )}
          />
          {/* Along the bottom: the top corners are where CS2 draws its radar and killfeed. */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between">
            <Badge
              className={cn(
                'tracking-normal normal-case backdrop-blur',
                RARE.has(highlight.kind) ? 'bg-white text-black' : 'bg-black/55 text-white',
              )}
            >
              {KIND_LABEL[highlight.kind]}
            </Badge>
            <span className="rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">
              {clock(Math.max(0, Math.min(total, Math.ceil(total - elapsed))))}
            </span>
          </div>
          {/* Only where there's no hover preview to say "this plays": touch, or keyboard focus. */}
          <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-focus-visible/thumb:opacity-100 pointer-coarse:opacity-100">
            {/* Opacity lives on the blurred circle itself: on a parent it would become the
              backdrop root and the blur would vanish mid-fade. */}
            <span
              className={cn(
                'grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur transition-[scale,opacity] ease-out-quart motion-reduce:scale-100',
                playing ? 'scale-90 opacity-0 duration-150' : 'scale-100 opacity-100 duration-200',
              )}
            >
              <Play className="ml-0.5 size-4 fill-white text-white" />
            </span>
          </span>
        </ClipLink>
        <div className="mt-3 flex gap-3">
          <PlayerAvatarLink
            steamId={highlight.steamId}
            src={player.avatarUrl}
            name={player.name}
            className="mt-0.5 size-8"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-medium">
              <ClipLink id={highlight.id} className="hover:text-foreground/80">
                {highlight.title}
              </ClipLink>
            </h3>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              <PlayerLink
                steamId={highlight.steamId}
                className="text-foreground/80 hover:text-foreground"
              >
                {player.name}
              </PlayerLink>
              {' · '}
              {context === undefined && (
                <>
                  <Link
                    to="/matches/$id"
                    params={{ id: highlight.matchId }}
                    className="hover:text-foreground"
                  >
                    {mapName(highlight.map)}
                  </Link>
                  {' · '}
                </>
              )}
              <RoundMoment
                matchId={highlight.matchId}
                momentId={highlight.id}
                player={player}
                trigger={(handlers) => (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-foreground"
                    {...handlers}
                  >
                    {context ?? `Round ${highlight.round}`}
                  </button>
                )}
              />
              {tags.length > 0 && <span> · {tags.join(' · ')}</span>}
            </p>
          </div>
        </div>
      </article>
    )
  },
  (prev, next) =>
    prev.context === next.context &&
    shallowEqual(prev.highlight, next.highlight) &&
    shallowEqual(prev.player, next.player),
)
