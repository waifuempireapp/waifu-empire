<template>
  <div :style="overlayStyle">

    <!-- Icona territorio: cerchio full-round con flip -->
    <div :style="{ perspective: '600px' }">
      <div :style="pixelStyle">
        <!-- Iniziale del nome proprietario -->
        <span :style="{
          fontFamily: FF.display, fontSize: '42px', fontWeight: 900,
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1, userSelect: 'none',
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }">
          {{ currentInitial }}
        </span>
      </div>
    </div>

    <!-- Testo -->
    <div style="text-align:center;padding:0 28px">
      <template v-if="phase === 'back' || phase === 'done'">
        <div :style="conquestTitleStyle">{{ $t("map.territory_conquered") }}</div>
        <div :style="pixelNameStyle">{{ pixelName }}</div>
        <div :style="empireNameStyle">
          Ora appartiene a
          <span :style="{ color: newColor || '#ff85b6', fontWeight: 800 }">{{ empireName }}</span>
        </div>
      </template>
      <div v-else :style="loadingStyle">{{ $t("map.conquering") }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}

const props = defineProps<{
  pixelName:      string
  oldColor:       string
  newColor:       string
  empireName:     string
  oldEmpireName?: string
}>()

const emit = defineEmits<{ done: [] }>()

type Phase = 'front' | 'flipping' | 'back' | 'done'
const phase = ref<Phase>('front')

onMounted(() => {
  const t1 = setTimeout(() => { phase.value = 'flipping' }, 600)
  const t2 = setTimeout(() => { phase.value = 'back' },     1000)
  const t3 = setTimeout(() => { phase.value = 'done'; emit('done') }, 2600)
  onUnmounted(() => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) })
})

const SIZE = 120

const isBack = computed(() => phase.value === 'back' || phase.value === 'done')

const currentColor   = computed(() => isBack.value ? props.newColor   : props.oldColor)
const currentInitial = computed(() => {
  const name = isBack.value ? props.empireName : (props.oldEmpireName || '?')
  return name.charAt(0).toUpperCase()
})

const rotation = computed(() =>
  phase.value === 'flipping' ? 'rotateY(90deg)' : 'rotateY(0deg)'
)

const { isDark } = useTheme()

const overlayStyle = computed((): CSSProperties => ({
  position: 'fixed', inset: 0, zIndex: 500,
  background: isDark.value ? 'rgba(3,2,12,0.88)' : 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(12px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '32px',
  animation: phase.value === 'done' ? 'fadeOutFast 0.3s forwards' : 'none',
}))

const pixelStyle = computed((): CSSProperties => ({
  width: `${SIZE}px`, height: `${SIZE}px`, borderRadius: '50%',
  background: currentColor.value,
  transform: rotation.value,
  transition: 'transform 0.45s ease-in-out',
  border: isBack.value
    ? `4px solid ${props.newColor}cc`
    : `3px solid rgba(255,255,255,0.25)`,
  animation: isBack.value ? 'conquestGlow 1s ease-in-out infinite' : 'none',
  boxShadow: isBack.value
    ? `0 0 0 8px ${props.newColor}22, 0 0 50px ${props.newColor}66`
    : '0 4px 24px rgba(0,0,0,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}))

const conquestTitleStyle = computed((): CSSProperties => ({
  fontFamily: FF.display, fontSize: '24px',
  color: isDark.value ? '#ffd666' : '#b07d00',
  fontWeight: 900, marginBottom: '10px', letterSpacing: '-0.01em',
}))
const pixelNameStyle = computed((): CSSProperties => ({
  fontFamily: FF.label, fontSize: '15px', fontWeight: 700, letterSpacing: '0.2em',
  color: 'var(--theme-text-2)', textTransform: 'uppercase', marginBottom: '8px',
}))
const empireNameStyle: CSSProperties = {
  fontFamily: FF.body, fontSize: '16px', color: 'var(--theme-text-2)', lineHeight: 1.5,
}
const loadingStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em',
  color: 'var(--theme-text-3)', textTransform: 'uppercase',
}
</script>

<style>
@keyframes fadeOutFast {
  to { opacity: 0; pointer-events: none; }
}
@keyframes conquestGlow {
  0%, 100% { box-shadow: 0 0 0 8px rgba(255,233,168,0.1), 0 0 20px rgba(255,233,168,0.3); }
  50%       { box-shadow: 0 0 0 14px rgba(255,233,168,0.15), 0 0 60px rgba(255,233,168,0.8); }
}
</style>
