import { TICKRATE, clipOffsetTicks, clipSegments, segmentsTicks } from '@subtick/domain'

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export const timeAgo = (date: Date | string | null | undefined) => {
  if (!date) return ''
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

const AGE_UNITS: [string, number][] = [
  ['y', 365 * 24 * 3600],
  ['w', 7 * 24 * 3600],
  ['d', 24 * 3600],
  ['h', 3600],
  ['m', 60],
]

/** Compact age for tight spots: "14m", "1h", "4d", "2w", never below "1m". */
export const shortAge = (date: Date | string | null | undefined) => {
  if (!date) return ''
  const seconds = (Date.now() - new Date(date).getTime()) / 1000
  for (const [unit, size] of AGE_UNITS)
    if (seconds >= size) return `${Math.floor(seconds / size)}${unit}`
  return '1m'
}

const SHORT_DATE = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const LONG_DATE = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })

/** "Oct 15, 21:04" this year, "Oct 15, 2025" otherwise. */
export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return ''
  const d = new Date(date)
  return d.getFullYear() === new Date().getFullYear()
    ? `${SHORT_DATE.format(d)}, ${TIME.format(d)}`
    : LONG_DATE.format(d)
}

const WEEKDAY = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' })

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()

/** Section heading for a day: "Today", "Yesterday", "Wednesday, Oct 14", "Oct 14, 2025". */
export const dayLabel = (date: Date | string | null | undefined) => {
  if (!date) return 'Earlier'
  const d = new Date(date)
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.getFullYear() === new Date().getFullYear() ? WEEKDAY.format(d) : LONG_DATE.format(d)
}

type ClipWindow = Parameters<typeof clipSegments>[0]

/** Length of a highlight's clip: its segments played back to back. */
export const clipSeconds = (h: ClipWindow) => Math.round(segmentsTicks(clipSegments(h)) / TICKRATE)

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export const clipLength = (h: ClipWindow) => clock(clipSeconds(h))

/** Where a demo tick plays in the highlight's clip, as "0:07". */
export const clipTime = (h: ClipWindow, tick: number) =>
  clock(Math.round(clipOffsetTicks(clipSegments(h), tick) / TICKRATE))

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
