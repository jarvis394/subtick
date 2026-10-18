import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Strong ease-out: the change starts at once and settles softly. */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const IN_MS = 220
/** The incoming text waits a beat, so it isn't muddled with the outgoing one at full strength. */
const IN_DELAY_MS = 40
const OUT_MS = 120

/**
 * A label that morphs when its text changes (Add email ↔ Cancel): the old text fades out over the
 * new one fading in, while the width eases to the new text's so the button doesn't jump.
 *
 * Nothing clips: the new text is laid out at its full width from the first frame (overflowing the
 * still-narrow box evenly while it is faint), and the old one is lifted out of the flow, so
 * neither moves when the other leaves.
 */
export const MorphLabel = ({
  children,
  align = 'center',
}: {
  children: string
  /** `start` for left-aligned labels (menu items); buttons center theirs. */
  align?: 'center' | 'start'
}) => {
  const incoming = useRef<HTMLSpanElement>(null)
  const outgoing = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(children)
  const [leaving, setLeaving] = useState<{ text: string; id: number } | null>(null)
  const [width, setWidth] = useState<number>()

  // Updated during render, so the old text never misses a frame between leaving and fading out.
  if (shown !== children) {
    setLeaving((previous) => ({ text: shown, id: (previous?.id ?? 0) + 1 }))
    setShown(children)
  }

  useLayoutEffect(() => {
    if (incoming.current) setWidth(incoming.current.offsetWidth)
  }, [shown])

  // WAAPI rather than CSS keyframes: it runs on exactly the elements that just changed, every time.
  useLayoutEffect(() => {
    if (!leaving) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setLeaving(null)
    incoming.current?.animate(
      [
        { opacity: 0, scale: '0.96' },
        { opacity: 1, scale: '1' },
      ],
      {
        duration: IN_MS,
        delay: IN_DELAY_MS,
        easing: EASE_OUT,
        fill: 'backwards',
      },
    )
    const out = outgoing.current?.animate([{ opacity: 1 }, { opacity: 0, scale: '0.96' }], {
      duration: OUT_MS,
      easing: 'ease-out',
      fill: 'forwards',
    })
    out?.finished
      .then(() => setLeaving((current) => (current?.id === leaving.id ? null : current)))
      // Cancelled by the next change, which replaces this one.
      .catch(() => {})
  }, [leaving])

  return (
    <span
      className={cn(
        'relative inline-flex whitespace-nowrap',
        align === 'center' ? 'justify-center' : 'justify-start',
        'transition-[width] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
      )}
      style={{ width }}
    >
      {leaving && (
        <span
          key={leaving.id}
          ref={outgoing}
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-0',
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
          )}
        >
          {leaving.text}
        </span>
      )}
      <span key={shown} ref={incoming} className="shrink-0">
        {shown}
      </span>
    </span>
  )
}
