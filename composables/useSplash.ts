// Stato GLOBALE dello splash di avvio.
// Lo splash (logo + carte) vive in app.vue e NON si smonta mai durante la
// navigazione (/, /login, /onboarding, /gioco): resta dipinto ininterrottamente
// dal primo frame finché la destinazione finale è pronta, poi sparisce UNA volta.
// Questo evita l'effetto "carte → loading → carte" ai cambi pagina.
export function useSplash() {
  const done = useState<boolean>('app-splash-done', () => false)
  return {
    splashDone: done,
    finishSplash: () => { done.value = true },
    // Riarma lo splash: usato quando, dopo il login, si naviga verso /gioco e
    // vogliamo che le carte coprano di nuovo il caricamento fino a home pronta.
    startSplash: () => { done.value = false },
  }
}
