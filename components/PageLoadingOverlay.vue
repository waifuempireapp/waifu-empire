<!-- Overlay solido che copre la pagina finché il 3D non è renderizzato.
     Stesso identico spinner + "Caricamento..." di AppLoading. -->
<template>
  <Transition name="page-reveal">
    <div v-if="!ready" class="page-loading-overlay" :style="background ? { background } : {}">
      <div class="page-loading-overlay__content">
        <div class="page-loading-overlay__spinner" />
        <span class="page-loading-overlay__text">Caricamento...</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  ready: boolean
  background?: string
}>()
</script>

<style scoped>
.page-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--bg-base, #F3F1F8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-loading-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.page-loading-overlay__spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--accent-soft, #E5DCF7);
  border-top-color: var(--accent, #8B6FD8);
  animation: page-spin 0.8s linear infinite;
}

@keyframes page-spin {
  to { transform: rotate(360deg); }
}

.page-loading-overlay__text {
  font-family: 'Nunito', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #8B86A3);
}

.page-reveal-leave-active {
  transition: opacity 0.35s ease-out;
}
.page-reveal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-loading-overlay__spinner { animation-duration: 1.5s; }
  .page-reveal-leave-active { transition: none; }
}
</style>
