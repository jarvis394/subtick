import { useEffect, useRef, useState } from 'react'

/** How long a copy confirms itself before going back. */
export const COPIED_MS = 1500

/** Says "copied" for a moment after `copy()`; the timer restarts on every copy, so clicks never race. */
export const useCopied = () => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- clears the pending "copied" timer on unmount
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return { copied, copy }
}
