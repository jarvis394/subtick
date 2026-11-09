import type { Played } from './facts'
import { barPercent, type PopupControl } from './match-column'

const connectorY = (rating: number, max: number) =>
  Math.min(92, Math.max(4, 100 - barPercent(rating, max)))

const connectorOutline = (start: number, end: number, rx: number, ry: number, offset: number) => {
  const topSegments = () => {
    if (start > end) {
      const xTarget = 100 - rx - offset
      const slope = (end - start) / xTarget
      const topStartX = rx
      const topStartY = start + rx * slope
      const lineEndX = xTarget - offset
      const lineEndY = end - offset * slope

      return [
        `M0 ${start + ry}`,
        `Q0 ${start} ${topStartX} ${topStartY}`,
        `L${lineEndX} ${lineEndY}`,
        `Q${xTarget} ${end} ${100 - rx} ${end}`,
        `Q100 ${end} 100 ${end + ry}`,
      ]
    }

    if (start < end) {
      const xTarget = rx + offset
      const slope = (end - start) / (100 - xTarget)
      const lineStartX = xTarget + offset
      const lineStartY = start + offset * slope
      const topEndX = 100 - rx
      const topEndY = end - rx * slope

      return [
        `M0 ${start + ry}`,
        `Q0 ${start} ${rx} ${start}`,
        `Q${xTarget} ${start} ${lineStartX} ${lineStartY}`,
        `L${topEndX} ${topEndY}`,
        `Q100 ${end} 100 ${end + ry}`,
      ]
    }

    return [
      `M0 ${start + ry}`,
      `Q0 ${start} ${rx} ${start}`,
      `L${100 - rx} ${end}`,
      `Q100 ${end} 100 ${end + ry}`,
    ]
  }

  return [
    ...topSegments(),
    `L100 ${100 - ry}`,
    `Q100 100 ${100 - rx} 100`,
    `L${rx} 100`,
    `Q0 100 0 ${100 - ry}`,
    'Z',
  ].join(' ')
}

/** Half a column wide, joining the ratings either side of a break between sessions. */
export const SessionConnector = ({
  from,
  to,
  max,
  popup,
}: {
  from: Played
  to: Played
  max: number
  popup: PopupControl
}) => {
  const start = connectorY(from.stats.rating, max)
  const end = connectorY(to.stats.rating, max)
  const outline = connectorOutline(start, end, 14, 3, 4)

  return (
    <>
      <div className="relative h-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full overflow-visible"
        >
          <path d={outline} fill="var(--background)" />
        </svg>
      </div>
      {/* Each half hands its hover to the match it faces, lighting up that column. */}
      {/* -inset-x-1 spans the gap-1 between sessions, and -top-10 covers the full chart height. */}
      <div className="absolute -inset-x-1 -top-10 bottom-0 z-10 flex">
        {[from, to].map((m) => (
          <div
            key={m.matchId}
            className="h-full w-1/2"
            data-match-id={m.matchId}
            onPointerEnter={(e) => popup.onColumn(m, e)}
          />
        ))}
      </div>
    </>
  )
}
