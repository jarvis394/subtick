import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { UpNext } from './up-next'
import type { ReelClip } from './use-reel'

/**
 * The video, crossfading between clips: a new clip's video stacks over the old one and fades in
 * once it has a frame to show, and only then is the old one dropped. Once a clip ends, the next
 * one is offered over it.
 */
export const VideoStage = ({
  clip,
  next,
  autoplay,
  onAutoplayChange,
  onNext,
  className,
}: {
  clip: ReelClip
  next?: ReelClip
  /** Count down to `next` once this clip ends, and preload it. */
  autoplay: boolean
  onAutoplayChange: (on: boolean) => void
  onNext: () => void
  className?: string
}) => {
  // The first clip shows at once (its poster stands in); later ones wait for a frame.
  const [layers, setLayers] = useState([{ clip, ready: true }])
  const [ended, setEnded] = useState(false)
  const top = layers.at(-1)!
  // Switching again before the new clip showed replaces it, so the last visible frame stays put.
  if (top.clip.id !== clip.id) {
    setLayers([top.ready ? top : layers[0]!, { clip, ready: false }])
    setEnded(false)
  }

  const upNext = ended ? next : undefined

  // Cancelling the countdown means "stop playing on", so it turns autoplay off as well.
  const cancel = () => {
    setEnded(false)
    if (autoplay) onAutoplayChange(false)
  }

  const dropBelow = (id: string) =>
    setLayers((ls) => ls.slice(ls.findIndex((l) => l.clip.id === id)))
  const markReady = (id: string) => {
    setLayers((ls) => ls.map((l) => (l.clip.id === id ? { ...l, ready: true } : l)))
    // No fade, so no transitionend to wait for.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) dropBelow(id)
  }

  return (
    <div className={cn('relative aspect-video overflow-hidden bg-black', className)}>
      {layers.map((layer, i) => (
        <VideoLayer
          key={layer.clip.id}
          clip={layer.clip}
          active={i === layers.length - 1}
          ready={layer.ready}
          onReady={() => markReady(layer.clip.id)}
          onShown={() => dropBelow(layer.clip.id)}
          onEnded={() => setEnded(true)}
          // Seeking back or pressing play again takes the card down.
          onResumed={() => setEnded(false)}
        />
      ))}
      {/* Warm the next clip so autoplay's switch has a frame to fade to straight away. */}
      {autoplay && next && top.ready && (
        <video key={next.id} src={next.clip.videoUrl} preload="auto" muted hidden />
      )}
      <AnimatePresence>
        {upNext && (
          <UpNext
            key="up-next"
            next={upNext}
            autoplay={autoplay}
            onPlay={onNext}
            onCancel={cancel}
            onDismiss={() => setEnded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const VideoLayer = ({
  clip,
  active,
  ready,
  onReady,
  onShown,
  onEnded,
  onResumed,
}: {
  clip: ReelClip
  active: boolean
  ready: boolean
  onReady: () => void
  onShown: () => void
  onEnded: () => void
  onResumed: () => void
}) => {
  const video = useRef<HTMLVideoElement>(null)

  // Arriving by click allows sound; a fresh tab may not, so fall back to muted playback.
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- plays and pauses the <video> element with the active layer
  useEffect(() => {
    const el = video.current
    if (!el || !active) return
    el.play().catch(() => {
      el.muted = true
      void el.play().catch(() => {})
    })

    return () => el.pause()
  }, [active])

  return (
    <video
      ref={video}
      src={clip.clip.videoUrl}
      poster={clip.clip.thumbnailUrl}
      controls={active}
      playsInline
      preload="auto"
      onLoadedData={ready ? undefined : onReady}
      onTransitionEnd={(e) => e.propertyName === 'opacity' && ready && onShown()}
      onEnded={active ? onEnded : undefined}
      onPlay={onResumed}
      onSeeking={onResumed}
      className={cn(
        'absolute inset-0 size-full transition-opacity duration-300 ease-out-quart motion-reduce:transition-none',
        ready ? 'opacity-100' : 'opacity-0',
        !active && 'pointer-events-none',
      )}
    />
  )
}
