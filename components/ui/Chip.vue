<!-- ============================================================
  Chip: etichetta / tag inline con colore e dimensione variabili.
  Supporta un'icona opzionale a sinistra del testo.
  ============================================================ -->
<script setup lang="ts">
// Props del chip: colore brand, icona opzionale e taglia xs/sm/md
withDefaults(defineProps<{
  colore?: string
  icon?:   string
  size?:   'xs' | 'sm' | 'md'
}>(), {
  colore: '#f5c560',
  icon:   undefined,
  size:   'sm',
})

// Mappa taglie → padding e font-size
const SIZES = {
  xs: { px: 7,  py: 2, fs: 9  },
  sm: { px: 10, py: 3, fs: 10 },
  md: { px: 14, py: 5, fs: 12 },
}
</script>

<template>
  <!-- Chip con sfondo semitrasparente e bordo colorato -->
  <span
    :style="{
      display:            'inline-flex',
      alignItems:         'center',
      gap:                '5px',
      padding:            `${SIZES[size].py}px ${SIZES[size].px}px`,
      background:         `${colore}13`,
      border:             `1px solid ${colore}55`,
      borderRadius:       '999px',
      fontSize:           `${SIZES[size].fs}px`,
      color:              colore,
      letterSpacing:      '0.14em',
      textTransform:      'uppercase',
      fontWeight:         700,
      fontFamily:         \"var(--ff-label, 'Saira Condensed', sans-serif)\",
      backdropFilter:     'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }"
  >
    <!-- Icona opzionale -->
    <span v-if="icon" style="display: inline-flex; align-items: center;">{{ icon }}</span>
    <slot />
  </span>
</template>
