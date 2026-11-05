export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

/** index.html reads the same key before first paint, so a stored theme never flashes. */
const KEY = 'subtick-theme'

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme)

export const storedTheme = (): Theme => {
  const value = localStorage.getItem(KEY)

  return isTheme(value) ? value : 'system'
}

/** `system` drops the attribute, so the tokens follow `prefers-color-scheme` again. */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'system') {
    localStorage.removeItem(KEY)
    delete root.dataset.theme
  } else {
    localStorage.setItem(KEY, theme)
    root.dataset.theme = theme
  }
}
