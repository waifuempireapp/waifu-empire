// ============================================================
// MIDDLEWARE: Rotte per guest (non autenticati)
// Redirige a /gioco se l'utente è già autenticato.
// Va usato sulle pagine come /login e /onboarding.
// ============================================================

export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  if (authStore.loading) return

  // Se già autenticato redirige al gioco
  if (authStore.isLoggedIn) {
    return navigateTo('/gioco')
  }
})
