import { useLayoutEffect, useRef, useState } from 'react'

/**
 * A button label that morphs when its text changes (Add email ↔ Cancel): the width eases to the
 * new text's while the new text fades in, so the button doesn't jump.
 */
export const MorphLabel = ({ children }: { children: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number>()
  const first = useRef(true)

  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.offsetWidth)
  }, [children])
  useLayoutEffect(() => void (first.current = false), [])

  return (
    <span
      className="inline-flex justify-center overflow-hidden transition-[width] duration-200 ease-out-quart motion-reduce:transition-none"
      style={{ width }}
    >
      <span
        ref={ref}
        key={children}
        className={
          first.current
            ? 'shrink-0 whitespace-nowrap'
            : 'shrink-0 animate-[morph-in_200ms_var(--ease-out-quart)] whitespace-nowrap motion-reduce:animate-none'
        }
      >
        {children}
      </span>
    </span>
  )
}
