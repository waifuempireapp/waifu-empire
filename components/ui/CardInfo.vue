<!-- ============================================================
  CardInfo: pannello statistiche / sintesi con glow colorato e
  hover interattivo. Porta diretta di UIKit.jsx CardInfo.
  ============================================================ -->
<script setup lang="ts">
// Props: colore brand e flag glow; onClick viene emesso al click
import type { CSSProperties } from 'vue'
const props = withDefaults(defineProps<{
  colore?: string
  glow?:   boolean
}>(), {
  colore: '#f5c560',
  glow:   true,
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

// Stile base della card
const cardStyle = computed((): CSSProperties => ({
  position:       'relative',
  padding:        '14px',
  background:     `linear-gradient(180deg, ${props.colore}10, ${props.colore}04)`,
  border:         `1px solid ${props.colore}30`,
  borderRadius:   '14px',
  boxShadow:      props.glow
    ? `0 0 14px ${props.colore}1f, 0 4px 14px rgba(3,2,12,0.4)`
    : 'none',
  cursor:         'default',
  transition:     'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
}))

// Hover attivo solo se viene ascoltato l'evento click (la card è interattiva)
function onMouseEnter(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  el.style.transform   = 'translateY(-2px)'
  el.style.borderColor = `${props.colore}66`
  el.style.boxShadow   = `0 0 22px ${props.colore}33, 0 8px 24px rgba(3,2,12,0.5)`
  el.style.cursor      = 'pointer'
}
function onMouseLeave(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  el.style.transform   = 'translateY(0)'
  el.style.borderColor = `${props.colore}30`
  el.style.boxShadow   = props.glow
    ? `0 0 14px ${props.colore}1f, 0 4px 14px rgba(3,2,12,0.4)`
    : 'none'
  el.style.cursor      = 'default'
}
function onClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <!-- Card informativa con glow e hover interattivo opzionale -->
  <div
    :style="cardStyle"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <slot />
  </div>
</template>
