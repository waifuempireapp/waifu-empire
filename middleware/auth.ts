// ============================================================
// MIDDLEWARE: Protezione rotte autenticate
// Redirige a /login se l'utente non è autenticato.
// Va usato sulle pagine che richiedono login (es. /gioco).
// ============================================================

export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()

  // Aspetta che il caricamento iniziale dell'auth sia completato
  if (authStore.loading) return

  // Redirige al login se l'utente non è autenticato
  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
