<!-- ============================================================
  PannelloOrnato: pannello glassmorphism notturno con bordi neon
  e angoli decorativi SVG. Varianti: default, dark, accent, purple.
  ============================================================ -->
<script setup lang="ts">
// Props: variant e glow personalizzabili, noCorners disabilita i bracket
import type { CSSProperties } from 'vue'
const props = withDefaults(defineProps<{
  variant?:   'default' | 'dark' | 'accent' | 'purple'
  glow?:      string
  noCorners?: boolean
  extraStyle?: Record<string, string>
}>(), {
  variant:   'default',
  glow:      '#f5c560',
  noCorners: false,
  extraStyle: () => ({}),
})

// Mappa delle varianti colore/sfondo
const VARIANTS = {
  default: { bg: 'linear-gradient(180deg, rgba(27,22,56,0.72), rgba(13,10,38,0.85))', border: 'rgba(174,156,255,0.18)' },
  dark:    { bg: 'linear-gradient(180deg, rgba(7,5,26,0.92), rgba(3,2,12,0.96))',     border: 'rgba(174,156,255,0.10)' },
  accent:  { bg: 'linear-gradient(180deg, rgba(245,197,96,0.10), rgba(245,197,96,0.04))', border: 'rgba(245,197,96,0.45)' },
  purple:  { bg: 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(13,10,38,0.85))', border: 'rgba(167,139,250,0.35)' },
}

const v = computed(() => VARIANTS[props.variant] ?? VARIANTS.default)

// Stile del pannello composito
const pannelloStyle = computed((): CSSProperties => ({
  position:              'relative',
  background:            v.value.bg,
  border:                `1px solid ${v.value.border}`,
  borderRadius:          '16px',
  padding:               '18px',
  backdropFilter:        'blur(14px)',
  WebkitBackdropFilter:  'blur(14px)',
  boxShadow:             `0 0 28px ${props.glow}1a, 0 10px 36px rgba(3,2,12,0.55), 0 1px 0 rgba(255,255,255,0.04) inset`,
  ...props.extraStyle,
}))

// Le 4 posizioni degli angoli (top-left, top-right, bottom-right, bottom-left)
const CORNERS: Array<{ style: CSSProperties; rotation: number }> = [
  { style: { top: '-1px', left: '-1px' },   rotation: 0   },
  { style: { top: '-1px', right: '-1px' },  rotation: 90  },
  { style: { bottom: '-1px', right: '-1px' }, rotation: 180 },
  { style: { bottom: '-1px', left: '-1px' }, rotation: 270 },
]
</script>

<template>
  <!-- Pannello con glassmorphism e bracket decorativi agli angoli -->
  <div :style="pannelloStyle">
    <!-- Angoli SVG decorativi (bracket) -->
    <template v-if="!noCorners">
      <svg
        v-for="(corner, i) in CORNERS"
        :key="i"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        :style="({
          position: 'absolute',
          transform: `rotate(${corner.rotation}deg)`,
          pointerEvents: 'none',
          ...corner.style,
        } as CSSProperties)"
      >
        <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" :fill="glow" opacity="0.55" />
      </svg>
    </template>

    <slot />
  </div>
</template>
