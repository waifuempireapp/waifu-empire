// useTheme — gestisce light/dark mode.
// Default: light (bianco). Dark: grigi, niente viola.
// Persiste in localStorage. Applica data-theme su <html>.

export function useTheme() {
  const isDark = useState<boolean>('theme-dark', () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('waifu_theme') === 'dark'
    }
    return false
  })

  function applyTheme(dark: boolean) {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    applyTheme(isDark.value)
    if (typeof window !== 'undefined') {
      localStorage.setItem('waifu_theme', isDark.value ? 'dark' : 'light')
    }
  }

  function initTheme() {
    applyTheme(isDark.value)
  }

  return { isDark, toggleTheme, initTheme }
}
