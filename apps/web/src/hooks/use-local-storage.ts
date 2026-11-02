import { useState } from 'react'

// Outside the hook: React Compiler can't lower a conditional inside `try`.
const read = <T>(key: string, initial: T): T => {
  try {
    const stored = localStorage.getItem(key)

    return stored === null ? initial : (JSON.parse(stored) as T)
  } catch {
    return initial
  }
}

/** Per-browser UI preference. Storage can be unavailable (private mode), so every access is guarded. */
export const useLocalStorage = <T>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => read(key, initial))

  const set = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Not persisted; the in-memory value still applies.
    }
  }

  return [value, set] as const
}
