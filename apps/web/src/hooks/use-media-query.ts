import { useSyncExternalStore } from 'react'

const lists = new Map<string, MediaQueryList>()

const listFor = (query: string) => {
  let list = lists.get(query)
  if (!list) {
    list = window.matchMedia(query)
    lists.set(query, list)
  }

  return list
}

export const useMediaQuery = (query: string) => {
  const subscribe = (onChange: () => void) => {
    const list = listFor(query)
    list.addEventListener('change', onChange)

    return () => list.removeEventListener('change', onChange)
  }

  return useSyncExternalStore(subscribe, () => listFor(query).matches)
}
