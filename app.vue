<!-- ============================================================
  app.vue — Root dell'applicazione Nuxt 3
  Registra il Service Worker per la cache degli asset ImageKit
  e renderizza la pagina corrente tramite <NuxtPage>.
  Sostituisce src/app/layout.jsx di Next.js.
============================================================ -->
<template>
  <NuxtPage />

  <!-- Splash di avvio UNICO e persistente: vive qui (app.vue non si smonta mai)
       così resta dipinto ininterrottamente attraverso tutti i redirect di boot
       (/ → /login|/onboarding|/gioco) e sparisce UNA sola volta quando la
       destinazione finale è pronta (finishSplash). Identico allo spa-loading-
       template pre-JS → handoff invisibile. -->
  <Transition name="splash-fade">
    <AppLoading v-if="!splashDone" fullscreen />
  </Transition>
</template>

<script setup lang="ts">
const { initTheme } = useTheme()
const { splashDone, finishSplash } = useSplash()

onMounted(() => {
  // Applica il tema salvato prima di qualsiasi render
  initTheme()

  // Rete di sicurezza: qualunque cosa accada, non lasciare lo splash bloccato.
  setTimeout(() => finishSplash(), 15000)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registrato, scope:', reg.scope))
      .catch((err) => console.warn('[SW] Registrazione fallita:', err))
  }
})
</script>

<style>
/* Fade-out unico dello splash quando l'app è pronta */
.splash-fade-leave-active { transition: opacity 0.5s ease; }
.splash-fade-leave-to { opacity: 0; }
</style>
