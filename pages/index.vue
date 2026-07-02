<!-- ============================================================
  Pagina radice: reindirizza a /gioco se loggata, altrimenti a /login.
  Equivalente di src/app/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const router    = useRouter()

// Aspetta che il listener Firebase sia pronto, poi reindirizza
watch(
  () => authStore.ready,
  (ready) => {
    if (!ready) return
    if (authStore.isLoggedIn) router.replace('/gioco')
    else router.replace('/login')
  },
  { immediate: true },
)

// Rete di sicurezza ANTI-LOADER-INFINITO: se dopo 10s l'inizializzazione di
// Firebase Auth non ha risposto (plugin fallito, rete che blocca googleapis,
// stato persistito corrotto su PWA/iOS…), non restare bloccati per sempre sul
// loader: manda al /login, dove l'utente puo' almeno riprovare l'accesso.
onMounted(() => {
  setTimeout(() => {
    if (!authStore.ready) router.replace('/login')
  }, 10000)
})
</script>

<template>
  <!-- Schermata di caricamento durante l'inizializzazione di Firebase Auth -->
  <AppLoading fullscreen />
</template>
