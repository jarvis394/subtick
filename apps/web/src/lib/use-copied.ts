import { useEffect, useRef, useState } from 'react'

/** How long a copy confirms itself before going back. */
export const COPIED_MS = 1500

/**
 * Copies text to clipboard, falling back to document.execCommand('copy')
 * when the modern Clipboard API is unavailable (e.g. non-secure LAN HTTP context).
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)

      return true
    } catch {
      // Fall through to fallback
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const success = document.execCommand('copy')
    textarea.remove()

    return success
  } catch {
    return false
  }
}

/** Says "copied" for a moment after `copy()`; the timer restarts on every copy, so clicks never race. */
export const useCopied = () => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- clears the pending "copied" timer on unmount
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = (text: string) => {
    void copyToClipboard(text)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return { copied, copy }
}
