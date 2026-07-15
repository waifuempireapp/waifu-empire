<script setup lang="ts">
import PackCarouselGL from '~/components/PackCarouselGL.vue'
const events = ref<string[]>([])
const vw = ref(390); const vh = ref(700)
onMounted(() => { vw.value = window.innerWidth; vh.value = window.innerHeight })
</script>
<template>
  <div style="position:fixed;inset:0;background:#14121f;">
    <PackCarouselGL :count="20" color="#7c5cff" :texture-url="null"
      :model-url="'/bustine/bustina_impero_stellare.glb'" :epic-glow="true" :width="vw" :height="vh"
      style="position:absolute;inset:0;"
      @ready="events.push('READY')" @picked="events.push('PICKED')" @open="events.push('OPEN')" />
    <div id="ev" style="position:absolute;top:6px;left:6px;color:#0f0;font-family:monospace;z-index:9;">{{ events.join('|') }}</div>
  </div>
</template>
