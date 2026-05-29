<template>
  <!-- Animazione conquista territorio: flip del pixel dal vecchio al nuovo colore -->
  <div :style="overlayStyle">
    <style>{{ keyframes }}</style>

    <!-- Pixel animato con flip -->
    <div :style="pixelStyle">
      <div v-if="phase === 'back'" :style="crownStyle">
        <span style="font-size:40px">♛</span>
      </div>
    </div>

    <!-- Testo stato -->
    <div style="text-align:center">
      <template v-if="phase === 'back' || phase === 'done'">
        <div :style="conquestTitleStyle">Territorio Conquistato!</div>
        <div :style="pixelNameStyle">{{ pixelName }}</div>
        <div :style="empireNameStyle">
          Ora appartiene a <span :style="{ color: newColor || C.sakura }">{{ empireName }}</span>
        </div>
      </template>
      <div v-else :style="loadingStyle">Conquista in corso…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Animazione flip territorio: mostra il passaggio di proprietà con effetto 3D
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
}
const C = {
  sakura: '#ff85b6',
}

const props = defineProps<{
  pixelName: string
  oldColor:  string
  newColor:  string
  empireName: string
}>()

const emit = defineEmits<{
  done: []
}>()

type Phase = 'front' | 'flipping' | 'back' | 'done'
const phase = ref<Phase>('front')

onMounted(() => {
  const t1 = setTimeout(() => { phase.value = 'flipping' }, 400)
  const t2 = setTimeout(() => { phase.value = 'back' }, 900)
  const t3 = setTimeout(() => { phase.value = 'done'; emit('done') }, 2200)
  onUnmounted(() => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) })
})

const SIZE = 100

const currentColor = computed(() =>
  phase.value === 'back' || phase.value === 'done' ? props.newColor : props.oldColor
)
const rotation = computed(() => {
  if (phase.value === 'flipping') return 'rotateY(90deg)'
  return 'rotateY(0deg)'
})

const keyframes = `
  @keyframes fadeOutFast { to { opacity: 0; pointer-events: none; } }
  @keyframes conquestGlow { 0%,100%{box-shadow:0 0 20px rgba(255,233,168,0.3)} 50%{box-shadow:0 0 50px rgba(255,233,168,0.8)} }
`

// Stili
const overlayStyle = computed(() => ({
  position: 'fixed', inset: 0, zIndex: 500,
  background: 'rgba(3,2,12,0.9)', backdropFilter: 'blur(8px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  animation: phase.value === 'done' ? 'fadeOutFast 0.3s forwards' : 'none',
}))
const pixelStyle = computed(() => ({
  width: `${SIZE}px`, height: `${SIZE}px`, borderRadius: '16px', marginBottom: '24px',
  background: currentColor.value,
  transform: rotation.value,
  transition: 'transform 0.5s ease-in-out, background 0.1s',
  border: phase.value === 'back' ? '3px solid rgba(255,233,168,0.7)' : '3px solid rgba(255,255,255,0.2)',
  animation: phase.value === 'back' ? 'conquestGlow 1s ease-in-out infinite' : 'none',
  boxShadow: phase.value === 'back' ? `0 0 40px ${props.newColor}80` : 'none',
}))
const crownStyle = {
  width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: 0.5,
}
const conquestTitleStyle = {
  fontFamily: FF.display, fontSize: '20px', color: '#ffd666', fontWeight: 800, marginBottom: '6px',
}
const pixelNameStyle = {
  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.2em',
  color: 'rgba(241,235,255,0.6)', textTransform: 'uppercase',
}
const empireNameStyle = {
  fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.4)', marginTop: '6px',
}
const loadingStyle = {
  fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.2em',
  color: 'rgba(241,235,255,0.35)', textTransform: 'uppercase',
}
</script>
