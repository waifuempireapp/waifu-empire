<template>
  <div :class="['app-panel', `app-panel--${variant}`]" :style="style">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'float' | 'neu' | 'glass' | 'sunken'
  style?:   string | Record<string, string>
}>(), { variant: 'float' })
</script>

<style scoped>
.app-panel {
  border-radius: var(--radius-panel, 28px);
  overflow: hidden;
}

/* ── FLOAT — pannello che galleggia sopra il background ── */
.app-panel--float {
  background: var(--surface-p, #FBFAFD);
  box-shadow: var(--shadow-float);
  border: 1px solid var(--theme-border);
}

/* ── NEU — neumorphic esterno (binders, tab bar My Cards) ── */
.app-panel--neu {
  background: var(--theme-bg);
  box-shadow: var(--shadow-neu-out);
  border: none;
}

/* ── GLASS — frosted glass ── */
.app-panel--glass {
  background: var(--surface-glass, rgba(251,250,253,0.78));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--shadow-float);
  border: 1px solid rgba(139,111,216,0.12);
}

/* ── SUNKEN — area incassata (input, slot) ── */
.app-panel--sunken {
  background: var(--surface-sunken, #ECE8F4);
  box-shadow: var(--shadow-neu-in);
  border: none;
}
</style>
