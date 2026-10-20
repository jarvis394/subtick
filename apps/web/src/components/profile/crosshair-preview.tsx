import type { Crosshair } from '@subtick/domain'
import { cn } from '@/lib/utils'

const rgba = ({ r, g, b, a }: Crosshair['color']) => `rgb(${r} ${g} ${b} / ${a / 255})`

interface Bar {
  x: number
  y: number
  w: number
  h: number
}

/** The crosshair's rectangles in its own pixels, centered on 0,0. */
const bars = (c: Crosshair): Bar[] => {
  const t = Math.max(c.thickness, 1)
  const half = t / 2
  const lines: Bar[] = []
  if (c.style !== 6 && c.length > 0) {
    const from = c.gap
    lines.push(
      { x: from, y: -half, w: c.length, h: t },
      { x: -from - c.length, y: -half, w: c.length, h: t },
      { x: -half, y: from, w: t, h: c.length },
    )
    if (!c.tStyle) lines.push({ x: -half, y: -from - c.length, w: t, h: c.length })
  }
  if (c.dot || c.style === 6) lines.push({ x: -half, y: -half, w: t, h: t })
  return lines
}

/** How far the drawing reaches from the center, outline included. */
const extent = (c: Crosshair) =>
  Math.max(Math.abs(c.gap) + c.length, c.thickness, 2) + (c.outlineMode ? 1 : 0)

const isCircle = (c: Crosshair) => c.style === 1 || c.style === 3

/**
 * Drawn at the crosshair's own pixel size and enlarged a little, pixels kept square
 * (`crispEdges`), so it reads as the game draws it, just larger.
 */
export const CrosshairPreview = ({
  crosshair,
  className,
}: {
  crosshair: Crosshair
  className?: string
}) => {
  // A fixed field of view (120 px at the crosshair's own resolution), so it shows at a modest,
  // steady zoom; only one too large for it widens the view.
  const r = Math.max(extent(crosshair) * 1.2, 60)
  const outline = crosshair.outlineMode === 2 ? 0.5 : 1
  const shapes = bars(crosshair)

  return (
    <svg
      viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={cn('block', className)}
    >
      {isCircle(crosshair) ? (
        <circle
          r={Math.max(crosshair.gap + crosshair.length, 4)}
          fill="none"
          stroke={rgba(crosshair.color)}
          strokeWidth={Math.max(crosshair.thickness, 1)}
          shapeRendering="geometricPrecision"
        />
      ) : (
        <>
          {crosshair.outlineMode > 0 &&
            shapes.map((b, i) => (
              <rect
                key={`o${i}`}
                x={b.x - outline}
                y={b.y - outline}
                width={b.w + outline * 2}
                height={b.h + outline * 2}
                fill={rgba(crosshair.outlineColor)}
              />
            ))}
          {shapes.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={rgba(crosshair.color)} />
          ))}
        </>
      )}
    </svg>
  )
}
