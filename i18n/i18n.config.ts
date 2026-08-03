// Config vue-i18n. `fallbackLocale: 'en'` (locale completo) evita che le lingue
// parzialmente tradotte (es/de/ja) mostrino le CHIAVI grezze quando manca una
// traduzione: ora ripiegano sull'inglese.
export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
}))
