import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const EXIT_MS = 150

type Layer = { key: string; node: ReactNode }

/**
 * Crossfades between views when `swapKey` changes. The old view stays mounted in the same grid cell
 * while it fades out and the new one fades in over it, so nothing waits on the exit. Swapping back
 * mid-fade picks the old view up from wherever its fade had got to.
 *
 * `enterDelay` holds the new view's fade-in back, so a placeholder that's only needed for a moment
 * (a skeleton on a fast load) is gone again before it was ever seen.
 *
 * `appear={false}` skips the fade-in of the very first view, for pages the route's view
 * transition already brings in.
 */
export const FadeSwap = ({
  swapKey,
  enterDelay = 0,
  appear = true,
  className,
  children,
}: {
  swapKey: string
  enterDelay?: number
  appear?: boolean
  className?: string
  children: ReactNode
}) => {
  const [current, setCurrent] = useState(swapKey)
  const [exiting, setExiting] = useState<Layer[]>([])
  const [swapped, setSwapped] = useState(false)
  // The current view as last painted: what stays on screen while it fades out.
  const painted = useRef(children)

  if (current !== swapKey) {
    setCurrent(swapKey)
    setSwapped(true)
    setExiting((layers) => [
      ...layers.filter((l) => l.key !== current && l.key !== swapKey),
      { key: current, node: painted.current },
    ])
  }

  useLayoutEffect(() => {
    painted.current = children
  })

  // Every outgoing view has finished fading by one exit after the latest swap.
  useEffect(() => {
    if (exiting.length === 0) return
    const timer = setTimeout(() => setExiting([]), EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting])

  // Keyed, and in a fixed order, so a view keeps its DOM node going from current to exiting (or
  // back) and its opacity transition carries over. Moving the node would restart it.
  const layers = [...exiting.filter((l) => l.key !== swapKey), { key: swapKey, node: children }]
  layers.sort((a, b) => (a.key < b.key ? -1 : 1))

  return (
    <div className={cn('grid', className)}>
      {layers.map((layer) => {
        const isCurrent = layer.key === swapKey
        return (
          <div
            key={layer.key}
            inert={!isCurrent}
            style={isCurrent ? { transitionDelay: `${enterDelay}ms` } : undefined}
            className={cn(
              'col-start-1 row-start-1 min-w-0 transition-opacity',
              isCurrent
                ? cn(
                    'relative z-1 duration-200 ease-out-quart',
                    (appear || swapped) && 'starting:opacity-0',
                  )
                : 'pointer-events-none opacity-0 duration-150 ease-out',
            )}
          >
            {layer.node}
          </div>
        )
      })}
    </div>
  )
}
