import { ref } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'af-tools-theme'
const theme = ref<Theme>('dark')

function applyTheme(value: Theme): void {
  document.documentElement.classList.toggle('dark', value === 'dark')
  document.documentElement.style.colorScheme = value
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', value === 'dark' ? '#0b1020' : '#f5f7fb')
}

export function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY)
  const preferred =
    stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'

  theme.value = preferred
  applyTheme(preferred)
}

export function useTheme() {
  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, theme.value)
    applyTheme(theme.value)
  }

  return { theme, toggleTheme }
}
