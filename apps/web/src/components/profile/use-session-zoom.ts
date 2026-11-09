import { animate, frame, type Transition, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useStableCallback } from '@/hooks/use-stable-callback'
import { EASE_OUT_QUART } from '@/lib/motion'
import { observeResize } from '@/lib/resizeObserve'
import type { Departure } from './session-track'
import { layoutSessions } from './session-layout'

const ZOOM: Transition = { duration: 0.45, ease: EASE_OUT_QUART }
const INSTANT: Transition = { duration: 0 }

/** Opens on the newest matches and stays there through late layout, until the user scrolls. */
const pinToEnd = (viewport: HTMLDivElement) => {
  const stop = observeResize([viewport, ...viewport.children], () => {
    viewport.scrollLeft = viewport.scrollWidth
  })

  for (const input of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
    viewport.addEventListener(input, stop, { once: true, passive: true })
  }

  return stop
}

/** Measures the scroller and turns the focused session into geometry, transitions and scroll. */
export const useSessionZoom = ({
  sessions,
  focusKey,
}: {
  sessions: { key: string; size: number }[]
  focusKey: string | null
}) => {
  const reduce = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const unpin = useRef<() => void>(undefined)
  const zoomedTo = useRef(focusKey)
  const returnTo = useRef<number>(undefined)
  const [{ available, rem }, setMeasured] = useState({ available: 0, rem: 16 })

  const [settled, setSettled] = useState({
    focusKey,
    available,
    camera: focusKey,
    transition: INSTANT,
  })

  // Only a zoom eases: a window resize has to track the window.
  if (settled.focusKey !== focusKey || settled.available !== available) {
    setSettled({
      focusKey,
      available,
      camera: focusKey ?? settled.camera,
      transition: settled.focusKey !== focusKey && !reduce ? ZOOM : INSTANT,
    })
  }

  const layout = layoutSessions({
    sessions,
    focus: focusKey,
    camera: focusKey ?? settled.camera,
    available,
    rem,
  })

  const departure: Departure = { away: layout.away, transition: reduce ? INSTANT : ZOOM }

  // A stable identity, or React would re-attach the ref each render and re-arm the pin.
  const setViewport = useStableCallback((viewport: HTMLDivElement | null) => {
    viewportRef.current = viewport
    if (!viewport) return

    const measure = () => {
      const nextRem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      // The content's px-4 gutter on both sides.
      const nextAvailable = viewport.clientWidth - 2 * nextRem

      setMeasured((prev) =>
        prev.available === nextAvailable && prev.rem === nextRem
          ? prev
          : { available: nextAvailable, rem: nextRem },
      )
    }

    measure()

    const stopMeasuring = observeResize(viewport, measure)

    unpin.current = pinToEnd(viewport)

    return () => {
      stopMeasuring()
      unpin.current?.()
    }
  })

  const scrollWithZoom = useStableCallback((target: string | null) => {
    const viewport = viewportRef.current

    if (!viewport || zoomedTo.current === target) return
    zoomedTo.current = target
    unpin.current?.()
    // Kept through a zoom reversed midway, whose scroll is only a passing value.
    if (target && returnTo.current === undefined) returnTo.current = viewport.scrollLeft

    const inputs = ['pointerdown', 'wheel', 'touchstart']
    const end = layout.scrollTo
    const destination = Math.min(target ? end : (returnTo.current ?? end), end)

    const forgetReturn = () => {
      if (!target) returnTo.current = undefined
    }

    // After render, so a growing chart has the room before the scroll asks for it.
    const scrollTo = (position: number) =>
      frame.postRender(() => {
        viewport.scrollLeft = position
      })

    const scroll = animate(viewport.scrollLeft, destination, {
      ...departure.transition,
      onUpdate: scrollTo,
      onComplete: () => {
        scrollTo(destination)
        forgetReturn()
      },
    })

    const takeOver = () => {
      scroll.stop()
      forgetReturn()
    }

    for (const input of inputs) viewport.addEventListener(input, takeOver, { passive: true })

    return () => {
      scroll.stop()
      for (const input of inputs) viewport.removeEventListener(input, takeOver)
    }
  })

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- scrollLeft has no prop; it must tween in step with the widths, on the same curve, or the zoom would drift or get clamped.
  useLayoutEffect(() => scrollWithZoom(focusKey), [focusKey, scrollWithZoom])

  return { setViewport, layout, transition: settled.transition, departure }
}
