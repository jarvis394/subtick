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
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/format'
import { KIND_LABEL, tagSummary } from '@/lib/highlights'
import { cn } from '@/lib/utils'
import type { ReelClip } from './use-reel'
import { VideoStage } from './video-stage'

/**
 * In the dialog the video runs nearly edge to edge: full-bleed below lg, like the match table on
 * phones, and with a narrower inset than the text below it from lg up.
 */
export const VIDEO_FRAME = 'lg:mx-3 lg:mt-3 lg:rounded-lg'
export const CONTENT_INSET = 'px-4 md:px-6'

export const Player = ({
  clip,
  next,
  onEnded,
  modal,
  onClose,
  autoplay,
  onAutoplayChange,
}: {
  clip: ReelClip
  autoplay: boolean
  onAutoplayChange: (on: boolean) => void
  /** The clip autoplay moves to, preloaded once this one is showing. */
  next?: ReelClip
  /** Autoplay's cue; only called while `next` is set. */
  onEnded: () => void
  modal: boolean
  onClose?: () => void
}) => {
  // The dialog's title is the clip's; on the page it is the page heading.
  const Title = modal ? Dialog.Title : 'h1'
  const tags = tagSummary(clip.kills)

  return (
    <div className="max-lg:contents">
      <VideoStage
        clip={clip}
        next={next}
        onEnded={onEnded}
        className={cn(
          // Under the phone header (the dialog's or the app's), at the very top from md.
          'z-10 max-lg:sticky max-lg:top-14 md:max-lg:top-0',
          modal
            ? VIDEO_FRAME
            : // The page's gutters: filled, so the reel doesn't show beside the stuck video.
              // Sideways only, so nothing above it is covered.
              'rounded-md max-lg:shadow-[-1rem_0_var(--color-surface),1rem_0_var(--color-surface)] md:max-lg:shadow-[-2rem_0_var(--color-surface),2rem_0_var(--color-surface)]',
        )}
      />

      <div className={cn(modal ? cn(CONTENT_INSET, 'max-lg:pb-4 md:max-lg:pb-6') : 'max-lg:pb-8')}>
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
          <Badge tone="brand" className={TAG_CASE}>
            {KIND_LABEL[clip.kind]}
          </Badge>
          {tags.map((tag) => (
            <Badge key={tag} className={TAG_CASE}>
              {tag}
            </Badge>
          ))}
          <Switch checked={autoplay} onCheckedChange={onAutoplayChange} className="ml-auto">
            Autoplay next
          </Switch>
        </div>
      </div>
    </div>
  )
}

/** Kinds and tags read as written ("Ace", "Low HP"), the same as on the cards and in the reel. */
const TAG_CASE = 'normal-case tracking-normal'
