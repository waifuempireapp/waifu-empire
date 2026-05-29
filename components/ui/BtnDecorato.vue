<!-- ============================================================
  BtnDecorato: bottone crystal-style con varianti primary / secondary /
  danger / success. Porta diretta di UIKit.jsx BtnDecorato.
  ============================================================ -->
<script setup lang="ts">
// Props: variante visiva, taglia, stato disabilitato e icona opzionale
const props = withDefaults(defineProps<{
  variant?:  'primary' | 'secondary' | 'danger' | 'success'
  size?:     'sm' | 'md' | 'lg'
  disabled?: boolean
  icon?:     string
}>(), {
  variant:  'primary',
  size:     'md',
  disabled: false,
  icon:     undefined,
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

// Tabella taglie → padding / font-size / letter-spacing / border-radius
const SIZES = {
  sm: { px: 14, py: 7,  fs: 10, ls: 1.5, br: 9  },
  md: { px: 20, py: 11, fs: 12, ls: 2,   br: 11 },
  lg: { px: 28, py: 15, fs: 14, ls: 2.5, br: 13 },
}

// Tabella varianti → colori, shadow, background hover
const VARIANTS = {
  primary: {
    bg:      'linear-gradient(180deg, rgba(245,197,96,0.32), rgba(245,197,96,0.10))',
    bgHover: 'linear-gradient(180deg, rgba(255,233,168,0.45), rgba(245,197,96,0.18))',
    color:   '#2a1f00',
    border:  'rgba(255,233,168,0.6)',
    shadow:
      '0 1px 0 rgba(255,255,255,0.55) inset, ' +
      '0 -10px 20px rgba(192,138,31,0.45) inset, ' +
      '0 8px 24px rgba(245,197,96,0.35)',
  },
  secondary: {
    bg:      'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
    bgHover: 'linear-gradient(180deg, rgba(245,197,96,0.18), rgba(245,197,96,0.04))',
    color:   '#f1ebff',
    border:  'rgba(255,255,255,0.16)',
    shadow:
      '0 1px 0 rgba(255,255,255,0.12) inset, ' +
      '0 -8px 16px rgba(0,0,0,0.4) inset, ' +
      '0 6px 20px rgba(0,0,0,0.45)',
  },
  danger: {
    bg:      'linear-gradient(180deg, rgba(255,91,108,0.20), rgba(255,91,108,0.06))',
    bgHover: 'linear-gradient(180deg, rgba(255,91,108,0.38), rgba(255,91,108,0.10))',
    color:   '#ffa8b0',
    border:  'rgba(255,91,108,0.45)',
    shadow:
      '0 1px 0 rgba(255,255,255,0.10) inset, ' +
      '0 -8px 18px rgba(120,20,40,0.5) inset, ' +
      '0 6px 18px rgba(255,91,108,0.25)',
  },
  success: {
    bg:      'linear-gradient(180deg, rgba(88,224,163,0.22), rgba(88,224,163,0.06))',
    bgHover: 'linear-gradient(180deg, rgba(88,224,163,0.40), rgba(88,224,163,0.10))',
    color:   '#a8f5cf',
    border:  'rgba(88,224,163,0.50)',
    shadow:
      '0 1px 0 rgba(255,255,255,0.10) inset, ' +
      '0 -8px 18px rgba(20,90,60,0.5) inset, ' +
      '0 6px 18px rgba(88,224,163,0.22)',
  },
}

const s = computed(() => SIZES[props.size] ?? SIZES.md)
const v = computed(() => VARIANTS[props.variant] ?? VARIANTS.primary)

// Stile base del pulsante (background viene sovrascritta da hover via ref)
const btnStyle = computed(() => ({
  position:        'relative',
  padding:         `${s.value.py}px ${s.value.px}px`,
  background:      v.value.bg,
  color:           v.value.color,
  border:          `1px solid ${v.value.border}`,
  borderRadius:    `${s.value.br}px`,
  fontFamily:      "var(--ff-label, 'Saira Condensed', sans-serif)",
  fontSize:        `${s.value.fs}px`,
  fontWeight:      700,
  letterSpacing:   `${s.value.ls}px`,
  cursor:          props.disabled ? 'not-allowed' : 'pointer',
  opacity:         props.disabled ? 0.35 : 1,
  boxShadow:       v.value.shadow,
  backdropFilter:  'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  transition:      'background 0.2s ease, transform 0.15s ease',
  textTransform:   'uppercase',
  display:         'inline-flex',
  alignItems:      'center',
  justifyContent:  'center',
  gap:             '7px',
  overflow:        'hidden',
}))

// Gestione hover via eventi: aggiorna inline background e transform
function onMouseEnter(e: MouseEvent) {
  if (props.disabled) return
  const el = e.currentTarget as HTMLElement
  el.style.background = v.value.bgHover
  el.style.transform  = 'translateY(-1px)'
}
function onMouseLeave(e: MouseEvent) {
  if (props.disabled) return
  const el = e.currentTarget as HTMLElement
  el.style.background = v.value.bg
  el.style.transform  = 'translateY(0)'
}
function onMouseDown(e: MouseEvent) {
  if (props.disabled) return
  ;(e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'
}
function onMouseUp(e: MouseEvent) {
  if (props.disabled) return
  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
}
function onClick(e: MouseEvent) {
  if (!props.disabled) emit('click', e)
}
</script>

<template>
  <!-- Pulsante crystal con riflesso obliquo e varianti colore -->
  <button
    :style="btnStyle"
    :disabled="disabled"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
  >
    <!-- Riflesso obliquo decorativo -->
    <span :style="{
      position:    'absolute',
      inset:       0,
      borderRadius: 'inherit',
      background:  'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
      opacity:     0.55,
      mixBlendMode: 'overlay',
      pointerEvents: 'none',
    }" />

    <!-- Icona opzionale -->
    <span v-if="icon" :style="{ position: 'relative', fontSize: `${s.fs * 1.2}px`, lineHeight: 1 }">
      {{ icon }}
    </span>

    <!-- Testo / slot -->
    <span style="position: relative;">
      <slot />
    </span>
  </button>
</template>
