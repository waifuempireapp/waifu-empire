<!-- Divisore decorativo con linee laterali e diamante centrale -->
<script setup lang="ts">
const props = withDefaults(defineProps<{ colore?: string; spazio?: number }>(), { colore: '#f5c560', spazio: 14 })
</script>

<template>
  <div :style="{ display:'flex', alignItems:'center', justifyContent:'center', margin:`${spazio}px 0`, gap:'10px' }">
    <div :style="{ flex:1, height:'1px', background:`linear-gradient(90deg, transparent, ${colore}50)` }" />
    <svg viewBox="0 0 8 8" width="7" height="7">
      <path d="M4,0 L8,4 L4,8 L0,4 Z" :fill="colore" opacity="0.55" />
    </svg>
    <div :style="{ flex:1, height:'1px', background:`linear-gradient(270deg, transparent, ${colore}50)` }" />
  </div>
</template>
