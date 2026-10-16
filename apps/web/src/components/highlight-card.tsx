import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { useRef } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/surface'
import { clipLength } from '@/lib/format'
import { KIND_LABEL, tagSummary } from '@/lib/highlights'
import type { Clip } from '@/lib/queries'

type ClipCardData = Pick<
  Clip,
  'id' | 'matchId' | 'kind' | 'title' | 'round' | 'startTick' | 'endTick' | 'kills'
> & {
  clip: NonNullable<Clip['clip']>
  map?: string | null
}

export interface HighlightPlayer {
  name: string
  avatarUrl: string | null
}

/** A recorded highlight: thumbnail that plays on hover, then who made it and where. */
export const HighlightCard = ({
  highlight,
  player,
  context,
}: {
  highlight: ClipCardData
  player: HighlightPlayer
  /** Defaults to "<map> · Round <n>". */
  context?: string
}) => {
  const video = useRef<HTMLVideoElement>(null)
  const tags = tagSummary(highlight.kills)

  return (
    <article className="group">
      <div
        className="relative aspect-video cursor-pointer overflow-hidden rounded-xl bg-surface-2"
        onMouseEnter={() => void video.current?.play().catch(() => {})}
        onMouseLeave={() => video.current?.pause()}
        onClick={() => (video.current?.paused ? video.current.play() : video.current?.pause())}
      >
        <video
          ref={video}
          src={highlight.clip.videoUrl}
          poster={highlight.clip.thumbnailUrl}
          preload="none"
          muted
          loop
          playsInline
          className="size-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between">
          <Badge className="bg-black/55 text-white backdrop-blur">
            {KIND_LABEL[highlight.kind]}
          </Badge>
          <span className="rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">
            {clipLength(highlight.startTick, highlight.endTick)}
          </span>
        </div>
        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-100 transition-opacity duration-200 group-hover:opacity-0">
          <span className="grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur">
            <Play className="ml-0.5 size-4 fill-white text-white" />
          </span>
        </span>
      </div>
      <div className="mt-3 flex gap-3">
        <Avatar src={player.avatarUrl} name={player.name} className="mt-0.5 size-8" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium">{highlight.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            <span className="text-foreground/80">{player.name}</span>
            {' · '}
            <Link
              to="/matches/$id"
              params={{ id: highlight.matchId }}
              className="hover:text-foreground"
            >
              {context ?? `${mapName(highlight.map)} · Round ${highlight.round}`}
            </Link>
            {tags.length > 0 && <span> · {tags.join(' · ')}</span>}
          </p>
        </div>
      </div>
    </article>
  )
}
