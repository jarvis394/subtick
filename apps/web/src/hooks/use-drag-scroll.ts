import { type AnimationPlaybackControls, animate, useReducedMotion } from 'motion/react'
import { type MouseEvent, type PointerEvent, type SyntheticEvent, useRef, useState } from 'react'

const DRAG_THRESHOLD_PX = 4
const RUBBER_BAND = 0.55
const VELOCITY_WINDOW_MS = 100
const MIN_GLIDE_SPEED = 100

const GLIDE = {
  type: 'inertia',
  power: 0.1,
  timeConstant: 200,
  bounceStiffness: 300,
  bounceDamping: 35,
  restDelta: 0.5,
} as const

/** Distance drawn for a drag `over` past the edge: it resists more the further it goes. */
const rubberBand = (over: number, size: number) =>
  Math.sign(over) * size * (1 - 1 / ((Math.abs(over) * RUBBER_BAND) / size + 1))

const clampToScroller = (el: HTMLElement, position: number) =>
  Math.min(Math.max(position, 0), el.scrollWidth - el.clientWidth)

/**
 * Mouse-drag sideways scrolling with inertia for a scroller; spread `handlers` on it. A press that
 * moves less than the threshold stays an ordinary click, and touch keeps its native scrolling. Past
 * either end the scroller itself shifts and springs back, so its parent has to clip it: moving the
 * content instead would shrink the scrollable area and cancel the shift out.
 */
export const useDragScroll = ({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: () => void
  /** Without coordinates when the drag ended somewhere the cursor can't be known. */
  onDragEnd: (point?: { x: number; y: number }) => void
}) => {
  const [dragging, setDragging] = useState(false)
  const swallowClick = useRef(false)
  const position = useRef(0)
  const gliding = useRef(false)
  const glide = useRef<AnimationPlaybackControls>(null)
  const reduceMotion = useReducedMotion()

  /** `next` may lie past either end, which shows as the shift rather than as scroll. */
  const place = (el: HTMLElement, next: number) => {
    const scrollLeft = clampToScroller(el, next)
    const over = next - scrollLeft

    position.current = next
    el.scrollLeft = scrollLeft
    el.style.translate = over ? `${-rubberBand(over, el.clientWidth)}px` : ''
  }

  const stopGlide = () => {
    glide.current?.stop()
    gliding.current = false
  }

  const interruptGlide = (el: HTMLElement) => {
    if (!gliding.current) return
    stopGlide()
    place(el, clampToScroller(el, position.current))
  }

  const startGlide = (el: HTMLElement, velocity: number) => {
    const resting = clampToScroller(el, position.current)

    if (reduceMotion) return place(el, resting)
    if (position.current === resting && Math.abs(velocity) < MIN_GLIDE_SPEED) return
    gliding.current = true
    // Inertia picks its own target, but Motion skips an animation whose keyframes are all equal.
    glide.current = animate(position.current, position.current + 1, {
      ...GLIDE,
      velocity,
      min: 0,
      max: el.scrollWidth - el.clientWidth,
      onUpdate: (next) => place(el, next),
      onComplete: () => {
        gliding.current = false
        place(el, clampToScroller(el, position.current))
      },
    })
  }

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      const el = e.currentTarget
      const { clientX: startX, pointerId } = e
      const samples = [{ t: e.timeStamp, x: startX }]
      let moved = false

      // Catching a glide only stops it; the press shouldn't also open what's under the cursor.
      swallowClick.current = gliding.current
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) {
        interruptGlide(el)

        return
      }
      const start = gliding.current ? position.current : el.scrollLeft

      stopGlide()
      position.current = start

      const releaseVelocity = () => {
        const recent = samples.filter((s) => performance.now() - s.t < VELOCITY_WINDOW_MS)
        const first = recent[0]
        const last = recent.at(-1)

        return first && last && last.t > first.t
          ? ((first.x - last.x) / (last.t - first.t)) * 1000
          : 0
      }

      const end = (ev?: globalThis.PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', abort)
        window.removeEventListener('blur', abort)
        setDragging(false)
        startGlide(el, releaseVelocity())
        if (moved) onDragEnd(ev && { x: ev.clientX, y: ev.clientY })
      }

      const abort = () => {
        // A canceled press never produces the click this flag would swallow.
        swallowClick.current = false
        end()
      }

      const move = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        // The release can happen where no event reaches us, such as outside an embedded frame.
        if (ev.buttons === 0) return end(ev)
        const dx = ev.clientX - startX

        if (!moved) {
          if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
          moved = true
          swallowClick.current = true
          el.setPointerCapture(pointerId)
          setDragging(true)
          onDragStart()
        }
        samples.push({ t: ev.timeStamp, x: ev.clientX })
        place(el, start - dx)
      }

      // On the window, because the first move of a fast drag can already be outside the scroller.
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', abort)
      window.addEventListener('blur', abort)
    },
    onWheel: (e: SyntheticEvent<HTMLElement>) => interruptGlide(e.currentTarget),
    onClickCapture: (e: MouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.preventDefault()
      e.stopPropagation()
    },
    // A link's or image's native drag would cancel the pointer stream mid-scroll.
    onDragStart: (e: SyntheticEvent) => e.preventDefault(),
  }

  return { dragging, handlers }
}
