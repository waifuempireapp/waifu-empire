<!-- ============================================================
  app.vue — Root dell'applicazione Nuxt 3
  Registra il Service Worker per la cache degli asset ImageKit
  e renderizza la pagina corrente tramite <NuxtPage>.
  Sostituisce src/app/layout.jsx di Next.js.
============================================================ -->
<template>
  <NuxtPage />
</template>

<script setup lang="ts">
const { initTheme } = useTheme()

onMounted(() => {
  // Applica il tema salvato prima di qualsiasi render
  initTheme()

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registrato, scope:', reg.scope))
      .catch((err) => console.warn('[SW] Registrazione fallita:', err))
  }
})
</script>
