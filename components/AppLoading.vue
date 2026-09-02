<!-- Loading INTERNO all'app (NON il boot: quello è BootSplash con le carte).
     - fullscreen → overlay a tutta pagina: SOLO spinner centrato (V+H) su sfondo
       leggermente blurrato, così si intravede cosa c'è dietro.
     - inline → spinner + "Caricamento..." dentro pannelli/liste. -->
<template>
  <div class="app-loading" :class="fullscreen ? 'app-loading--fullscreen' : 'app-loading--inline'">
    <div class="app-loading__content">
      <div class="app-loading__spinner" />
      <span v-if="!fullscreen" class="app-loading__text">{{ $t("loading.text") }}</span>
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
.app-loading { display: flex; align-items: center; justify-content: center; }

/* Overlay a tutta pagina: centrato V+H, sfondo blurrato semi-trasparente */
.app-loading--fullscreen {
  position: fixed; inset: 0; z-index: 9999;
  /* Velo translucido theme-aware (non l'opaco --theme-loading) così lo sfondo
     resta intravedibile dietro il blur. Fallback rgba per browser vecchi. */
  background: rgba(12, 9, 22, 0.32);
  background: color-mix(in srgb, var(--theme-loading, #17161B) 42%, transparent);
  -webkit-backdrop-filter: blur(7px);
          backdrop-filter: blur(7px);
}
.app-loading--inline { width: 100%; padding: 40px 0; }

.app-loading__content { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.app-loading__spinner {
  width: 40px; height: 40px; border-radius: 50%;
  border: 3px solid var(--accent-soft, #E5DCF7);
  border-top-color: var(--accent, #8B6FD8);
  animation: app-spin 0.8s linear infinite;
}
@keyframes app-spin { to { transform: rotate(360deg); } }
.app-loading__text {
  font-family: 'Nunito', sans-serif; font-size: 0.85rem; font-weight: 600;
  letter-spacing: 0.5px; color: var(--text-secondary, #8B86A3);
}
@media (prefers-reduced-motion: reduce) { .app-loading__spinner { animation-duration: 1.5s; } }
</style>
