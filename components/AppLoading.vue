<!-- Loading standard dell'app: spinner circolare + "Caricamento..." sotto.
     fullscreen → overlay fisso a tutta pagina; inline → dentro pannelli/liste. -->
<template>
  <div class="app-loading" :class="{ 'app-loading--fullscreen': fullscreen, 'app-loading--inline': !fullscreen }">
    <div class="app-loading__content">
      <div class="app-loading__spinner" />
      <span class="app-loading__text">Caricamento...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  fullscreen?: boolean
}>(), {
  fullscreen: false,
})
</script>

<style scoped>
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-loading--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--bg-base, #F3F1F8);
}

.app-loading--inline {
  width: 100%;
  padding: 40px 0;
}

.app-loading__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.app-loading__spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--accent-soft, #E5DCF7);
  border-top-color: var(--accent, #8B6FD8);
  animation: app-spin 0.8s linear infinite;
}

@keyframes app-spin {
  to { transform: rotate(360deg); }
}

.app-loading__text {
  font-family: 'Nunito', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #8B86A3);
}

@media (prefers-reduced-motion: reduce) {
  .app-loading__spinner { animation-duration: 1.5s; }
}
</style>
