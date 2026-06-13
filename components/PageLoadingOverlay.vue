<!-- Overlay solido che copre la pagina finché il 3D non è renderizzato.
     Elimina il flash del pre-render delle bustine: fade-out morbido quando 'ready'. -->
<template>
  <Transition name="page-reveal">
    <div
      v-if="!ready"
      class="page-loading-overlay"
      :style="background ? { background } : {}"
    >
      <div class="page-loading-spinner" />
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
  /* Sfondo solido = colore base della pagina (tema-aware) → copre tutto il pre-render */
  background: var(--bg-base, #F3F1F8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-loading-spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid var(--accent-soft, #E5DCF7);
  border-top-color: var(--accent, #8B6FD8);
  animation: pageSpin 0.8s linear infinite;
}
@keyframes pageSpin {
  to { transform: rotate(360deg); }
}

/* Uscita: fade morbido che sembra intenzionale */
.page-reveal-leave-active {
  transition: opacity 0.35s ease-out;
}
.page-reveal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-loading-spinner { animation: none; }
  .page-reveal-leave-active { transition: none; }
}
</style>
