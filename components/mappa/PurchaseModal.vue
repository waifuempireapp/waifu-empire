<template>
  <!-- Modale di acquisto territorio: prezzo fisso per CPU, offerta libera per giocatori -->
  <div :style="overlayStyle">
    <div :style="sheetStyle">
      <!-- Label sezione -->
      <div :style="{ fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }">
        🩷 Acquisto Territorio
      </div>

      <!-- Nome territorio -->
      <div :style="{ fontFamily: FF.display, fontSize: '16px', color: 'var(--theme-text)', fontWeight: 900, marginBottom: '6px', lineHeight: 1.1 }">
        {{ pixelLabel }}
      </div>

      <!-- Proprietario / tipo -->
      <div :style="{ fontFamily: FF.body, fontSize: '16px', color: 'var(--theme-text-2)', marginBottom: '24px' }">
        {{ isCPU ? 'Territorio libero — prezzo fisso' : `Proprietario: ${pixel?.ownerName}` }}
      </div>

      <!-- Prezzo fisso CPU -->
      <div v-if="isCPU" :style="cpuPriceBox">
        <KissesIcon :size="22" />
        <span :style="{ fontFamily: FF.label, fontSize: '28px', color: C.gold, fontWeight: 900 }">{{ basePrice }}</span>
        <span :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)', letterSpacing: '0.15em' }">KISSES</span>
      </div>

      <!-- Offerta libera per giocatori -->
      <div v-else :style="{ marginBottom: '24px' }">
        <label :style="offerLabelStyle">La tua offerta (Kisses)</label>
        <div :style="{ display: 'flex', alignItems: 'center', gap: '10px' }">
          <KissesIcon :size="20" />
          <input v-model="offerAmount" type="number" :min="1" :style="inputStyle" />
        </div>
        <div :style="{ fontFamily: FF.label, fontSize: '18px', fontWeight: 700, color: canAfford ? '#16a34a' : C.err, marginTop: '8px', letterSpacing: '0.06em' }">
          Saldo: {{ profilo?.kisses ?? 0 }} Kisses{{ !canAfford ? ' — insufficienti' : '' }}
        </div>
      </div>

      <!-- Bottoni azione -->
      <div :style="{ display: 'flex', gap: '10px' }">
        <button :style="cancelBtnStyle" @click="$emit('close')">Annulla</button>
        <button
          :disabled="loading || !canAfford || amount <= 0"
          :style="confirmBtnStyle"
          @click="handleConfirm"
        >
          {{ loading ? '...' : isCPU ? '🩷 Acquista' : '💌 Invia Offerta' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PIXEL_NAMES } from '~/utils/worldMap'
import type { CSSProperties } from 'vue'

const authStore = useAuthStore()

interface Pixel {
  x: number
  y: number
  ownerId: string
  ownerName?: string
  ownerLevel?: number
}

interface Profilo {
  kisses?: number
}

const props = defineProps<{
  pixel: Pixel | null
  profilo: Profilo | null
}>()

const emit = defineEmits<{
  confirm: [payload: { amount: number }]
  close: []
}>()

const C = {
  gold:   '#f5c560',
  sakura: '#ff85b6',
  ok:     '#58e0a3',
  err:    '#ff5b6c',
  violet: '#a78bfa',
}
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}

const isCPU     = computed(() => props.pixel?.ownerId === 'CPU')
const basePrice = computed(() => 200 + ((props.pixel?.ownerLevel ?? 1) * 50))
const pixelLabel = computed(() => PIXEL_NAMES[`${props.pixel?.x}_${props.pixel?.y}`] ?? `(${props.pixel?.x}, ${props.pixel?.y})`)

const offerAmount = ref(String(basePrice.value))
const loading     = ref(false)

const amount    = computed(() => parseInt(offerAmount.value, 10) || 0)
const canAfford = computed(() => (props.profilo?.kisses ?? 0) >= amount.value)

useScrollLock()

const handleConfirm = async () => {
  if (!canAfford.value || amount.value <= 0) return
  loading.value = true
  try {
    emit('confirm', { amount: isCPU.value ? basePrice.value : amount.value })
  } finally {
    loading.value = false
  }
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)',
  display: 'flex', alignItems: 'flex-end',
}
const sheetStyle: CSSProperties = {
  width: '100%',
  background: 'var(--theme-surface)',
  borderTop: '1px solid var(--theme-border)',
  borderRadius: '20px 20px 0 0',
  padding: '24px 24px 40px',
  boxShadow: '0 -8px 40px var(--theme-shadow)',
}
const cpuPriceBox: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
  padding: '18px',
  background: 'rgba(245,197,96,0.08)',
  border: '1.5px solid rgba(245,197,96,0.3)',
  borderRadius: '14px', marginBottom: '24px',
}
const offerLabelStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em',
  color: 'var(--theme-text-2)', textTransform: 'uppercase',
  display: 'block', marginBottom: '10px',
}
const inputStyle = computed((): CSSProperties => ({
  flex: 1,
  background: 'var(--theme-input-bg, var(--theme-shimmer))',
  border: `1.5px solid ${canAfford.value ? 'rgba(167,139,250,0.7)' : 'rgba(255,91,108,0.6)'}`,
  borderRadius: '10px',
  color: 'var(--theme-text)',
  fontFamily: FF.label,
  fontSize: '26px',
  fontWeight: 700,
  padding: '12px 16px',
}))
const cancelBtnStyle: CSSProperties = {
  flex: 1, padding: '14px',
  background: 'var(--theme-shimmer)',
  border: '1px solid var(--theme-border)',
  borderRadius: '999px',
  color: 'var(--theme-text-2)',
  fontFamily: FF.label, fontSize: '16px',
  letterSpacing: '0.18em', textTransform: 'uppercase',
  fontWeight: 700, cursor: 'pointer',
}
const confirmBtnStyle = computed((): CSSProperties => ({
  flex: 2, padding: '14px',
  background: canAfford.value && amount.value > 0 && !loading.value
    ? 'linear-gradient(135deg, #c54a86, #ff85b6)'
    : 'var(--theme-shimmer)',
  border: 'none', borderRadius: '999px',
  color: canAfford.value && amount.value > 0 ? '#fff' : 'var(--theme-text-3)',
  fontFamily: FF.label, fontSize: '16px',
  letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 800, cursor: canAfford.value && amount.value > 0 ? 'pointer' : 'not-allowed',
  boxShadow: canAfford.value && amount.value > 0 ? '0 4px 16px rgba(255,133,182,0.4)' : 'none',
}))
</script>
