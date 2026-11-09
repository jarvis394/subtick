/** Sizes in rem: a match column, the gap between neighbours, the connector between sessions. */
const ITEM = 3.5
const GAP = 0.25
const CONNECTOR = 1.75

export type Slot = { left: number; width: number }

export const connectorId = (sessionKey: string) => `${sessionKey}-connector`

/** Any room the columns leave over is shared equally, so every column stays the same width. */
const placeInRow = (sessions: { key: string; size: number }[], available: number, rem: number) => {
  const slots: Record<string, Slot> = {}
  const columns = sessions.reduce((sum, { size }) => sum + size, 0)
  const connectors = (sessions.length - 1) * (CONNECTOR + 2 * GAP)
  const gaps = (columns - sessions.length) * GAP
  const natural = (columns * ITEM + gaps + connectors) * rem
  const item = ITEM * rem + Math.max(0, available - natural) / columns
  let cursor = 0

  sessions.forEach(({ key, size }, i) => {
    slots[key] = { left: cursor, width: size * item + (size - 1) * GAP * rem }
    cursor += slots[key].width + GAP * rem
    if (i === sessions.length - 1) return
    slots[connectorId(key)] = { left: cursor, width: CONNECTOR * rem }
    cursor += (CONNECTOR + GAP) * rem
  })

  return { slots, total: cursor - GAP * rem }
}

/**
 * Pixel geometry for the chart. `slots` is where everything shown belongs. `away` is where each
 * track goes when `camera` fills the chart: zoomed by the same factor and pushed off-canvas, so
 * entering and leaving read as one zoom. `scrollTo` is the furthest this view can scroll, which
 * puts the newest match in sight.
 */
export const layoutSessions = ({
  sessions,
  focus,
  camera,
  available,
  rem,
}: {
  sessions: { key: string; size: number }[]
  focus: string | null
  camera: string | null
  available: number
  rem: number
}) => {
  const { slots: row, total: rowTotal } = placeInRow(sessions, available, rem)
  const anchor = camera ? row[camera] : undefined
  const origin = anchor?.left ?? 0

  const fitted = (key: string) => Math.max(row[key]?.width ?? 0, available)

  const zoom = camera && anchor ? fitted(camera) / anchor.width : 1

  const away = Object.fromEntries(
    Object.entries(row).map(([id, { left, width }]) => [
      id,
      { left: (left - origin) * zoom, width: width * zoom },
    ]),
  )

  const total = focus ? fitted(focus) : rowTotal

  return {
    slots: focus ? { [focus]: { left: 0, width: total } } : row,
    away,
    total,
    scrollTo: Math.max(0, total - available),
  }
}
