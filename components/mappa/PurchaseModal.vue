<template>
  <!-- Modale di acquisto territorio: prezzo fisso per CPU, offerta libera per giocatori -->
  <div :style="overlayStyle">
    <div :style="sheetStyle">
      <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase', marginBottom: '4px' }">
        🩷 Acquisto Territorio
      </div>
      <div :style="{ fontFamily: FF.display, fontSize: '20px', color: '#fff', fontWeight: 800, marginBottom: '4px' }">
        {{ pixelLabel }}
      </div>
      <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.5)', marginBottom: '24px' }">
        {{ isCPU ? 'Territorio libero — prezzo fisso' : `Proprietario: ${pixel?.ownerName}` }}
      </div>

      <!-- Prezzo fisso CPU -->
      <div v-if="isCPU" :style="cpuPriceBox">
        <KissesIcon :size="20" />
        <span :style="{ fontFamily: FF.display, fontSize: '24px', color: C.gold, fontWeight: 800 }">{{ basePrice }}</span>
        <span :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(241,235,255,0.5)' }">KISSES</span>
      </div>

      <!-- Offerta libera per giocatori -->
      <div v-else :style="{ marginBottom: '24px' }">
        <label :style="offerLabelStyle">La tua offerta (Kisses)</label>
        <div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
          <KissesIcon :size="18" />
          <input
            v-model="offerAmount"
            type="number"
            :min="1"
            :style="inputStyle"
          />
        </div>
        <div :style="{ fontFamily: FF.body, fontSize: '11px', color: canAfford ? C.ok : C.err, marginTop: '6px' }">
          Saldo: {{ profilo?.kisses ?? 0 }} Kisses {{ !canAfford ? '— insufficienti' : '' }}
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
// Modale di acquisto territorio — prezzi fissi (CPU) o offerta libera (giocatori)
import { PIXEL_NAMES } from '~/utils/worldMap'

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

// Costanti colori e font
const C = {
  gold:   '#f5c560',
  goldL:  '#ffe9a8',
  sakura: '#ff85b6',
  aqua:   '#6cf0e0',
  violet: '#a78bfa',
  ok:     '#58e0a3',
  err:    '#ff5b6c',
}
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
  mono:    "'JetBrains Mono', monospace",
}

const isCPU    = computed(() => props.pixel?.ownerId === 'CPU')
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

// Stili computati
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(3,2,12,0.92)', backdropFilter: 'blur(16px)',
  display: 'flex', alignItems: 'flex-end',
}
const sheetStyle = {
  width: '100%', background: 'rgba(13,10,38,0.98)',
  borderTop: '1px solid rgba(245,197,96,0.2)',
  borderRadius: '20px 20px 0 0',
  padding: '24px 24px 40px',
}
const cpuPriceBox = {
  display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
  padding: '16px', background: 'rgba(245,197,96,0.08)',
  border: '1px solid rgba(245,197,96,0.25)', borderRadius: '14px', marginBottom: '24px',
}
const offerLabelStyle = {
  fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.18em',
  color: 'rgba(174,156,255,0.7)', textTransform: 'uppercase',
  display: 'block', marginBottom: '8px',
}
const inputStyle = computed(() => ({
  flex: 1, background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${canAfford.value ? 'rgba(245,197,96,0.3)' : 'rgba(255,91,108,0.5)'}`,
  borderRadius: '10px', color: '#fff',
  fontFamily: FF.mono, fontSize: '18px', padding: '10px 14px',
}))
const cancelBtnStyle = {
  flex: 1, padding: '12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(174,156,255,0.2)', borderRadius: '12px',
  color: 'rgba(241,235,255,0.5)', fontFamily: FF.label, fontSize: '12px',
  letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
}
const confirmBtnStyle = computed(() => ({
  flex: 2, padding: '12px',
  background: canAfford.value && amount.value > 0 && !loading.value
    ? 'linear-gradient(135deg, #c08a1f, #f5c560)'
    : 'rgba(255,255,255,0.06)',
  border: 'none', borderRadius: '12px',
  color: canAfford.value && amount.value > 0 ? '#1a0024' : 'rgba(241,235,255,0.3)',
  fontFamily: FF.label, fontSize: '13px',
  letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 700, cursor: canAfford.value && amount.value > 0 ? 'pointer' : 'not-allowed',
}))
</script>
