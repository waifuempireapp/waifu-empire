// ============================================================
// waitAuthReady — attende la PRIMA risposta di Firebase Auth.
//
// I middleware di rotta girano UNA volta sola, al momento della navigazione.
// Su un avvio a freddo (link diretto, refresh, PWA riaperta) in quel momento
// authStore.loading è ancora true: senza attendere, il middleware non decide
// nulla e non viene più rieseguito → si resta su una rotta sbagliata con lo
// splash acceso finché non scatta la rete di sicurezza di app.vue (15s), e
// sotto c'è una pagina vuota.
//
// initAuthListener() ha già la propria rete di sicurezza a 8s che sblocca
// `loading` anche se onAuthStateChanged non risponde: questa promise si
// risolve quindi SEMPRE, non può appendere la navigazione.
// ============================================================
import type { useAuthStore } from '~/stores/auth'

export function waitAuthReady(authStore: ReturnType<typeof useAuthStore>): Promise<void> {
  if (!authStore.loading) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const stop = watch(
      () => authStore.loading,
      (loading) => { if (!loading) { stop(); resolve() } },
    )
  })
}
