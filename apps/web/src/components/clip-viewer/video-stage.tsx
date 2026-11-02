import { useEffect, useRef, useState } from 'react'
import { useStableCallback } from '@/hooks/use-stable-callback'
import { cn } from '@/lib/utils'
import type { ReelClip } from './use-reel'

/** Pause after a clip ends before autoplay moves on, so the switch doesn't feel like a cut. */
const AUTOPLAY_DELAY_MS = 1000

/**
 * The video, crossfading between clips: a new clip's video stacks over the old one and fades in
 * once it has a frame to show, and only then is the old one dropped.
 */
export const VideoStage = ({
  clip,
  next,
  onEnded,
  className,
}: {
  clip: ReelClip
  next?: ReelClip
  onEnded: () => void
  className?: string
}) => {
  // The first clip shows at once (its poster stands in); later ones wait for a frame.
  const [layers, setLayers] = useState([{ clip, ready: true }])
  const top = layers.at(-1)!
  // Switching again before the new clip showed replaces it, so the last visible frame stays put.
  if (top.clip.id !== clip.id) setLayers([top.ready ? top : layers[0]!, { clip, ready: false }])

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
          onEnded={next ? onEnded : undefined}
        />
      ))}
      {/* Warm the next clip so autoplay's switch has a frame to fade to straight away. */}
      {next && top.ready && (
        <video key={next.id} src={next.clip.videoUrl} preload="auto" muted hidden />
      )}
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
}: {
  clip: ReelClip
  active: boolean
  ready: boolean
  onReady: () => void
  onShown: () => void
  onEnded?: () => void
}) => {
  const video = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)

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

  // Seeking back or pressing play again during the pause cancels the move on.
  const advance = useStableCallback(() => onEnded?.())
  const canAdvance = Boolean(onEnded)
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- autoplay timer that moves on after a clip ends
  useEffect(() => {
    if (!ended || !active || !canAdvance) return
    const timer = setTimeout(advance, AUTOPLAY_DELAY_MS)

    return () => clearTimeout(timer)
  }, [ended, active, canAdvance, advance])

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
      onEnded={() => setEnded(true)}
      onPlay={() => setEnded(false)}
      onSeeking={() => setEnded(false)}
      className={cn(
        'absolute inset-0 size-full transition-opacity duration-300 ease-out-quart motion-reduce:transition-none',
        ready ? 'opacity-100' : 'opacity-0',
        !active && 'pointer-events-none',
      )}
    />
  )
}
