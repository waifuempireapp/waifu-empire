// ============================================================
// MIDDLEWARE: Protezione rotte autenticate
// Redirige a /login se l'utente non è autenticato.
// Va usato sulle pagine che richiedono login (es. /gioco).
// ============================================================

export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  // Attende la prima risposta di Firebase PRIMA di decidere: il middleware non
  // viene rieseguito, quindi uscire qui con `loading` ancora true lasciava la
  // rotta protetta montata a vuoto (vedi waitAuthReady).
  await waitAuthReady(authStore)

  // Redirige al login se l'utente non è autenticato
  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
