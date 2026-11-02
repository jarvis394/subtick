import { Play } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FadeImage } from '@/components/ui/fade-image'
import { Card } from '@/components/ui/surface'
import { useStableCallback } from '@/hooks/use-stable-callback'
import { EASE_OUT_QUART } from '@/lib/motion'
import type { ReelClip } from './use-reel'

/** Long enough to read the next clip's title and cancel; clips themselves run 10–30s. */
const COUNTDOWN_S = 3

const enter = { duration: 0.2, ease: EASE_OUT_QUART }

/**
 * Over the video once a clip ends: the clip that plays next, counting down to it while autoplay is
 * on, or waiting for Play while it's off. A click on the dimmed video around it hides it for this
 * clip without touching autoplay; Cancel is the explicit "stop playing on".
 */
export const UpNext = ({
  next,
  autoplay,
  onPlay,
  onCancel,
  onDismiss,
}: {
  next: ReelClip
  autoplay: boolean
  onPlay: () => void
  onCancel: () => void
  onDismiss: () => void
}) => {
  const play = useStableCallback(onPlay)

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- countdown timer that plays the next clip while the card shows
  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(play, COUNTDOWN_S * 1000)

    return () => clearTimeout(timer)
  }, [autoplay, play])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={enter}
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
      className="absolute inset-0 z-10 grid place-items-center bg-black/60 p-2 backdrop-blur-sm sm:p-3"
    >
      <motion.div
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={enter}
        className="w-full max-w-sm"
      >
        <Card role="group" aria-label="Up next" className="p-3 shadow-xl sm:p-4">
          <p className="text-label font-medium text-muted">Up next</p>
          <div className="mt-2 flex gap-3">
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-3">
              <FadeImage src={next.clip.thumbnailUrl} alt="" className="size-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-small leading-snug font-medium">{next.title}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-label text-muted">
                <Avatar
                  src={next.player.avatarUrl}
                  name={next.player.name}
                  className="size-4 text-micro"
                />
                <span className="truncate">{next.player.name}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={onPlay}>
              {autoplay ? <CountdownRing /> : <Play />}
              {autoplay ? 'Play now' : 'Play next'}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
              {autoplay ? 'Cancel' : 'Dismiss'}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

/** Fills over the countdown, so the Play button shows when it will press itself. */
const CountdownRing = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="-rotate-90">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.3} />
    <motion.circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: COUNTDOWN_S, ease: 'linear' }}
    />
  </svg>
)
