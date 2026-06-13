<template>
  <button
    :disabled="disabled"
    :class="['app-btn', `app-btn--${variant}`, size && `app-btn--${size}`, { 'app-btn--icon': icon }]"
    :style="customStyle"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'soft' | 'glass' | 'circle' | 'danger' | 'success'
  size?:    'sm' | 'md' | 'lg'
  icon?:    boolean
  disabled?: boolean
  customStyle?: string | Record<string, string>
}>(), {
  variant: 'soft',
  size:    'md',
})
</script>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  font-family: var(--ff-body);
  font-weight: 800;
  letter-spacing: 0.01em;
  border-radius: var(--radius-pill);
  transition: transform 0.1s ease, box-shadow 0.15s ease, background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.app-btn:active:not(:disabled) { transform: scale(0.96); }
.app-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── SIZES ── */
.app-btn--sm  { padding: 8px 18px;  font-size: 13px; }
.app-btn--md  { padding: 12px 28px; font-size: 15px; }
.app-btn--lg  { padding: 16px 36px; font-size: 17px; }

/* ── PRIMARY ── */
.app-btn--primary {
  background: var(--accent-p, #8B6FD8);
  color: #fff;
  box-shadow: var(--shadow-float);
}
.app-btn--primary:hover:not(:disabled) {
  background: var(--theme-accent-hover, #6E4FC4);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(110,79,196,0.22), 0 4px 8px rgba(110,79,196,0.12);
}

/* ── SOFT / GLASS (dominante in Pocket) ── */
.app-btn--soft {
  background: var(--surface-glass, rgba(251,250,253,0.78));
  color: var(--theme-text-2);
  border: 1px solid var(--theme-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-float);
}
.app-btn--soft:hover:not(:disabled) {
  background: var(--surface-raised, #fff);
  transform: translateY(-1px);
}

.app-btn--glass {
  background: var(--surface-glass, rgba(251,250,253,0.70));
  color: var(--theme-text-2);
  border: 1px solid rgba(139,111,216,0.18);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: var(--shadow-float);
}

/* ── DANGER ── */
.app-btn--danger {
  background: rgba(232,93,117,0.15);
  color: #E85D75;
  border: 1.5px solid rgba(232,93,117,0.4);
  box-shadow: var(--shadow-float);
}

/* ── SUCCESS ── */
.app-btn--success {
  background: linear-gradient(135deg, #16a34a, #22c55e);
  color: #fff;
  box-shadow: 0 6px 24px rgba(34,197,94,0.35);
}

/* ── CIRCLE ── */
.app-btn--circle {
  width: 52px;
  height: 52px;
  padding: 0;
  border-radius: 50%;
  background: var(--surface-raised, #fff);
  color: var(--theme-text-2);
  box-shadow: var(--shadow-float);
  border: 1px solid var(--theme-border);
}
.app-btn--circle.app-btn--sm { width: 38px; height: 38px; }
.app-btn--circle.app-btn--lg { width: 64px; height: 64px; }
</style>
