import { Dialog } from '@base-ui/react/dialog'
import { mapName } from '@subtick/domain'
import { Link } from '@tanstack/react-router'
import { MapIcon } from '@/components/map-icon'
import { playerSlug } from '@/components/player-link'
import { RoundMoment } from '@/components/round-moment'
import { ShareActions } from '@/components/share-actions'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/surface'
import { formatDate } from '@/lib/format'
import { KIND_LABEL, KIND_TONE, kindFilterOf, tagSummary } from '@/lib/highlights'
import { cn } from '@/lib/utils'
import type { ReelClip } from './use-reel'
import { VideoStage } from './video-stage'

/**
 * In the dialog the video runs nearly edge to edge: full-bleed in one column, like the match table on
 * phones, and with a narrower inset than the text below it in two.
 */
export const VIDEO_FRAME = '@3xl:mx-3 @3xl:mt-3 @3xl:rounded-lg'
export const CONTENT_INSET = 'px-4 md:px-6'

export const Player = ({
  clip,
  next,
  autoplay,
  onAutoplayChange,
  onNext,
  modal,
  onClose,
}: {
  clip: ReelClip
  /** Offered over the video once this clip ends. */
  next?: ReelClip
  autoplay: boolean
  onAutoplayChange: (on: boolean) => void
  onNext: () => void
  modal: boolean
  onClose?: () => void
}) => {
  // The dialog's title is the clip's; on the page it is the page heading.
  const Title = modal ? Dialog.Title : 'h1'
  const tags = tagSummary(clip.kills)

  return (
    <div className="@max-3xl:contents">
      <VideoStage
        clip={clip}
        next={next}
        autoplay={autoplay}
        onAutoplayChange={onAutoplayChange}
        onNext={onNext}
        className={cn(
          // Under the phone header (the dialog's or the app's), at the very top from md.
          'z-10 @max-3xl:sticky @max-3xl:top-14 md:@max-3xl:top-0',
          modal
            ? VIDEO_FRAME
            : // Full-bleed in one column: out over the page's gutters (1rem, 2rem
              // from md), square-cornered, so the reel never shows beside the stuck video.
              '-mx-4 md:-mx-8 @3xl:mx-0 @3xl:rounded-md',
        )}
      />

      <div
        className={cn(
          modal ? cn(CONTENT_INSET, '@max-3xl:pb-4 md:@max-3xl:pb-6') : '@max-3xl:pb-8',
        )}
      >
        {/* Buttons stay on the first line; a long title wraps beside them. */}
        <div className="mt-5 flex items-start gap-3">
          <Title className="min-w-0 flex-1 text-heading leading-8 font-semibold tracking-tight text-balance">
            {clip.title}
          </Title>
          <ShareActions url={`${window.location.origin}/clips/${clip.id}`} title={clip.title} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1">
          {/* A button like its neighbours, so the dots space evenly; pulled left by its padding so
            the avatar lines up with the title. */}
          <Button
            variant="plain"
            size="sm"
            render={
              <Link
                to="/players/$player"
                params={{
                  player: playerSlug({ steamId: clip.steamId, vanity: clip.player.vanity }),
                }}
                onClick={onClose}
              />
            }
            className="-ml-1.5 min-w-0 pl-1.5 text-lead font-medium"
          >
            <Avatar
              src={clip.player.avatarUrl}
              name={clip.player.name}
              className="size-6 text-micro"
            />
            <span className="truncate">{clip.player.name}</span>
          </Button>
          <span aria-hidden className="text-border-strong select-none max-sm:hidden">
            ·
          </span>
          {/* Its own line on phones, pulled left by the buttons' padding so the text lines up with
            the avatar. */}
          <div className="flex min-w-0 items-center gap-x-0.5 max-sm:-ml-2.5 max-sm:basis-full">
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/matches/$id" params={{ id: clip.matchId }} onClick={onClose} />}
              showCurrent={false}
              className="min-w-0 text-lead"
            >
              {/* Same 24px box as the avatar, with a smaller logo inside. */}
              <span className="grid size-6 shrink-0 place-items-center">
                <MapIcon map={clip.map} className="size-5 rounded-sm text-micro" />
              </span>
              <span className="truncate">
                {mapName(clip.map)}
                {clip.playedAt && (
                  <>
                    <span aria-hidden className="mx-1.5 text-border-strong">
                      ·
                    </span>
                    {formatDate(clip.playedAt)}
                  </>
                )}
              </span>
            </Button>
            <span aria-hidden className="text-border-strong select-none">
              ·
            </span>
            <RoundMoment
              matchId={clip.matchId}
              momentId={clip.id}
              player={clip.player}
              renderTrigger={(handlers) => (
                <Button variant="ghost" size="sm" className="text-lead" {...handlers}>
                  Round {clip.round}
                </Button>
              )}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Link to="/" search={{ kind: kindFilterOf(clip.kind) }} className={TAG_LINK}>
            <Badge
              tone={KIND_TONE[clip.kind] ?? 'neutral'}
              outlined={Boolean(KIND_TONE[clip.kind])}
              interactive
              className={TAG_CASE}
            >
              {KIND_LABEL[clip.kind]}
            </Badge>
          </Link>
          {tags.map(({ tag, label }) => (
            <Link key={tag} to="/" search={{ tags: [tag] }} className={TAG_LINK}>
              <Badge interactive className={TAG_CASE}>
                {label}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Kinds and tags read as written ("Ace", "Low HP"), at the size of the controls around them. */
const TAG_CASE = 'h-7 rounded-lg px-2.5 text-small tracking-normal normal-case'

/** Each badge opens the highlights feed filtered to it. */
const TAG_LINK = 'rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring'
