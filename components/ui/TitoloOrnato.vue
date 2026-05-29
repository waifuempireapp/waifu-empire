<!-- Titolo decorato con linee laterali e glow — usato come intestazione sezione -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  livello?: 1 | 2 | 3
  colore?: string
  glow?: boolean
  allineamento?: 'center' | 'left'
}>(), { livello: 1, colore: '#f5c560', glow: true, allineamento: 'center' })

const sizes = { 1: { fs:'clamp(20px,3.8vw,30px)', ls:0, mb:12, fw:800 }, 2: { fs:'clamp(15px,2.6vw,20px)', ls:0.5, mb:9, fw:700 }, 3: { fs:'clamp(12px,2vw,15px)', ls:1.5, mb:7, fw:700 } }
const s = computed(() => sizes[props.livello] ?? sizes[1])
const textStyle = computed(() => ({
  fontFamily:"var(--ff-display,'Unbounded',sans-serif)",
  fontSize: s.value.fs, fontWeight: s.value.fw, letterSpacing: `${s.value.ls}px`,
  color: props.colore,
  textShadow: props.glow ? `0 0 18px ${props.colore}55, 0 0 32px ${props.colore}22` : 'none',
  whiteSpace: 'nowrap',
}))
</script>

<template>
  <div :style="{ display:'flex', alignItems:'center', justifyContent: allineamento === 'center' ? 'center' : 'flex-start', gap:'14px', marginBottom:`${s.mb}px` }">
    <div v-if="allineamento === 'center'" :style="{ flex:1, height:'1px', maxWidth:'110px', background:`linear-gradient(90deg, transparent, ${colore}66)` }" />
    <div :style="textStyle"><slot /></div>
    <div v-if="allineamento === 'center'" :style="{ flex:1, height:'1px', maxWidth:'110px', background:`linear-gradient(270deg, transparent, ${colore}66)` }" />
  </div>
</template>
