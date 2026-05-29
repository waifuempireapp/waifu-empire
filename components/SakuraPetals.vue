<!-- Petali di sakura che cadono su tutta la schermata — effetto decorativo globale -->
<script setup lang="ts">
const PETAL_COUNT = 18

const petals = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  id:       i,
  left:     `${(i * 5.6 + Math.sin(i * 1.3) * 12 + 50) % 100}%`,
  delay:    `${((i * 0.7) % 9).toFixed(1)}s`,
  duration: `${(7 + (i % 7) * 1.2).toFixed(1)}s`,
  size:     `${6 + (i % 4) * 2}px`,
  opacity:  (0.25 + (i % 5) * 0.1).toFixed(2),
}))
</script>

<template>
  <!-- Contenitore fixed: copre tutto lo schermo, non intercetta touch -->
  <div style="position:fixed; inset:0; pointer-events:none; z-index:1; overflow:hidden;">
    <div
      v-for="p in petals"
      :key="p.id"
      class="sakura-petal"
      :style="{
        left:              p.left,
        animationDelay:    p.delay,
        animationDuration: p.duration,
        width:             p.size,
        height:            p.size,
        opacity:           0,
      }"
    />
  </div>
</template>
