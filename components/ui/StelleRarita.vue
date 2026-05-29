<!-- ============================================================
  StelleRarita: visualizza N stelle colorate con glow per indicare
  la rarità di un elemento (waifu, outfit, ecc.).
  ============================================================ -->
<script setup lang="ts">
// Props: numero di stelle, colore e dimensione in pixel
withDefaults(defineProps<{
  stelle:      number
  colore?:     string
  dimensione?: number
}>(), {
  colore:      '#f5c560',
  dimensione:  12,
})
</script>

<template>
  <!-- Riga di stelle con drop-shadow colorato -->
  <div style="display: inline-flex; gap: 1px;">
    <span
      v-for="i in stelle"
      :key="i"
      :style="{
        color:  colore,
        fontSize: `${dimensione}px`,
        filter: `drop-shadow(0 0 4px ${colore})`,
      }"
    >★</span>
  </div>
</template>
