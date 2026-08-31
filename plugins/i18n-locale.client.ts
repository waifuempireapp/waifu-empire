// Imposta la lingua salvata (localStorage 'waifu_locale') PRIMA del primo render,
// così la schermata di caricamento appare già nella lingua giusta e non si vede
// più il flicker "Loading..." (fallback en) → "Caricamento..." (it).
export default defineNuxtPlugin(async (nuxtApp) => {
  if (typeof localStorage === 'undefined') return
  const saved = localStorage.getItem('waifu_locale')
  if (!saved) return
  const i18n = nuxtApp.$i18n as {
    locale?: { value: string }
    setLocale?: (l: string) => Promise<void>
  } | undefined
  if (!i18n || i18n.locale?.value === saved) return
  try { await i18n.setLocale?.(saved) } catch { /* noop */ }
})
