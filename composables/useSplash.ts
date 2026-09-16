// Stato GLOBALE dello splash di avvio.
// Lo splash (logo + carte) vive in app.vue e NON si smonta mai durante la
// navigazione (/, /login, /onboarding, /gioco): resta dipinto ininterrottamente
// dal primo frame finché la destinazione finale è pronta, poi sparisce UNA volta.
// Questo evita l'effetto "carte → loading → carte" ai cambi pagina.

// Durata massima dello splash. La rete di sicurezza vive QUI e non in app.vue
// perché deve essere RIARMATA a ogni startSplash(): con un solo setTimeout piazzato
// al mount di app.vue, chi restava a lungo sul login lo consumava a vuoto, e lo
// splash riacceso dopo l'accesso non aveva più nessun limite → se poi /gioco si
// bloccava (le letture Firestore non rifiutano: senza rete restano appese per
// sempre) le carte restavano dipinte all'infinito.
const SPLASH_MAX_MS = 15000

export function useSplash() {
  const done = useState<boolean>('app-splash-done', () => false)
  const timer = useState<number | null>('app-splash-timer', () => null)

  const clearNet = () => {
    if (timer.value !== null) { clearTimeout(timer.value); timer.value = null }
  }
  // Arma (o riarma) il limite massimo: da qui a SPLASH_MAX_MS lo splash sparisce
  // comunque, qualunque cosa sia successa alla destinazione.
  const armNet = () => {
    if (import.meta.server) return
    clearNet()
    timer.value = window.setTimeout(() => { timer.value = null; done.value = true }, SPLASH_MAX_MS)
  }

  return {
    splashDone: done,
    finishSplash: () => { clearNet(); done.value = true },
    // Riarma lo splash: usato quando, dopo il login, si naviga verso /gioco e
    // vogliamo che le carte coprano di nuovo il caricamento fino a home pronta.
    startSplash: () => { done.value = false; armNet() },
    // Chiamata una volta da app.vue per il limite dello splash di boot.
    armSplashSafetyNet: armNet,
  }
}
