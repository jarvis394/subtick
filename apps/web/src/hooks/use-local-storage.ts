import { useCallback, useState } from 'react'

/** Per-browser UI preference. Storage can be unavailable (private mode), so every access is guarded. */
export const useLocalStorage = <T>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Not persisted; the in-memory value still applies.
      }
    },
    [key],
  )
  return [value, set] as const
}
