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
    <div class="glow-pulse text-5xl text-amber-400 font-cinzel">♛</div>
    <div
      class="font-cinzel tracking-widest text-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-purple-500
             bg-clip-text text-transparent"
    >
      IMPERO DELLE WAIFU
    </div>
    <div class="text-xs opacity-60 tracking-widest">caricamento...</div>
  </div>
</template>
