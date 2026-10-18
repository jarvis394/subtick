import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Exit is quicker than entry: the system is responding, not presenting. */
const EXIT_MS = 200

interface Entry<T> {
  key: string
  item: T
  /** Gone from the list; still shown while it collapses out. */
  exiting: boolean
  /** Added after the list first rendered, so it animates in. */
  entering: boolean
}

/**
 * Keeps items that left a list rendered at their old place for a moment, so they can animate out
 * instead of vanishing. Items present once the list has loaded (`ready`) don't animate in.
 */
export const usePresence = <T,>(
  items: T[],
  getKey: (item: T) => string,
  ready = true,
): Entry<T>[] => {
  const keys = items.map(getKey)
  const signature = keys.join('\n')
  const [previous, setPrevious] = useState({ signature, items, keys })
  const [leaving, setLeaving] = useState<{ key: string; item: T; index: number }[]>([])
  const initial = useRef<Set<string> | null>(null)
  if (ready && !initial.current) initial.current = new Set(keys)

  // Updated during render (React's "state from the previous render" pattern), so an item never
  // misses a frame between leaving the list and starting its exit.
  if (previous.signature !== signature) {
    const now = new Set(keys)
    const gone = previous.keys.flatMap((key, index) =>
      now.has(key) ? [] : [{ key, item: previous.items[index]!, index }],
    )
    setPrevious({ signature, items, keys })
    setLeaving((current) => [
      ...current.filter((l) => !now.has(l.key) && !gone.some((g) => g.key === l.key)),
      ...gone,
    ])
  }

  useEffect(() => {
    if (!leaving.length) return
    const timer = setTimeout(
      () => setLeaving((current) => current.filter((l) => !leaving.includes(l))),
      EXIT_MS,
    )
    return () => clearTimeout(timer)
  }, [leaving])

  const entries: Entry<T>[] = items.map((item, i) => ({
    key: keys[i]!,
    item,
    exiting: false,
    entering: initial.current !== null && !initial.current.has(keys[i]!),
  }))
  for (const l of leaving.toSorted((a, b) => a.index - b.index))
    entries.splice(Math.min(l.index, entries.length), 0, {
      key: l.key,
      item: l.item,
      exiting: true,
      entering: false,
    })
  return entries
}

/**
 * A list item's wrapper that grows in and collapses out: its height (via grid rows) and opacity
 * together, so the items around it close the gap instead of jumping.
 */
export const Collapse = ({
  exiting,
  entering,
  className,
  children,
}: {
  exiting?: boolean
  entering?: boolean
  className?: string
  children: ReactNode
}) => (
  <div
    inert={exiting}
    className={cn(
      // min-w-0 on both layers: as a grid or flex item it may shrink, so long text inside truncates.
      'grid min-w-0 grid-rows-[1fr] motion-reduce:transition-none',
      exiting
        ? 'grid-rows-[0fr] opacity-0 [transition:grid-template-rows_200ms_var(--ease-out-quart),opacity_150ms_ease-out]'
        : '[transition:grid-template-rows_250ms_var(--ease-out-quart),opacity_250ms_ease-out]',
      entering && 'starting:grid-rows-[0fr] starting:opacity-0',
      className,
    )}
  >
    {/* Clipped only while it can be animating, so focus rings at rest aren't cut off. */}
    <div className={cn('min-h-0 min-w-0', (exiting || entering) && 'overflow-hidden')}>
      {children}
    </div>
  </div>
)

/** One element that collapses out when `show` turns false (a list's whole section). */
export const Presence = ({
  show,
  className,
  children,
}: {
  show: boolean
  className?: string
  children: ReactNode
}) => {
  const [entry] = usePresence(show ? [children] : [], () => 'only')
  if (!entry) return null
  return (
    <Collapse exiting={entry.exiting} entering={entry.entering} className={className}>
      {entry.item}
    </Collapse>
  )
}
