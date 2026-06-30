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

  // Imposta il tema a un valore specifico (es. ripristino dal profilo Firebase)
  function setTheme(dark: boolean) {
    isDark.value = dark
    applyTheme(dark)
    if (typeof window !== 'undefined') {
      localStorage.setItem('waifu_theme', dark ? 'dark' : 'light')
    }
  }

  function toggleTheme() {
    setTheme(!isDark.value)
  }

  function initTheme() {
    applyTheme(isDark.value)
  }

  return { isDark, toggleTheme, setTheme, initTheme }
}
