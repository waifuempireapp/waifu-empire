<!-- Frame circolare con glow per avatar personaggio -->
<script setup lang="ts">
const props = withDefaults(defineProps<{ colore?: string; dimensione?: number }>(), { colore: '#f5c560', dimensione: 80 })
</script>

<template>
  <div :style="{
    position:'relative', width:`${dimensione}px`, height:`${dimensione}px`,
    borderRadius:'50%',
    background:`radial-gradient(circle at 30% 25%, ${colore}25, rgba(7,5,26,0.85))`,
    border:`2px solid ${colore}aa`,
    boxShadow:`0 0 16px ${colore}55, inset 0 0 12px rgba(0,0,0,0.3)`,
    display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
  }">
    <div :style="{ position:'absolute', inset:'3px', borderRadius:'50%', border:`1px solid ${colore}33`, pointerEvents:'none' }" />
    <slot />
  </div>
</template>
