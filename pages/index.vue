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
</script>

<template>
  <!-- Schermata di caricamento durante l'inizializzazione di Firebase Auth -->
  <div class="min-h-screen flex flex-col items-center justify-center gap-5">
    <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu" style="width: min(90vw, 440px); height: auto;" />
    <div class="text-xs opacity-60 tracking-widest">caricamento...</div>
  </div>
</template>
