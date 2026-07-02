<template>
  <!-- Classifica territori con kisses passivi — modale centrata -->
  <div v-if="open" :style="overlayStyle" @click.self="emit('close')">
    <div :style="wrapperStyle">

    <!-- Header modale: titolo + chiudi -->
    <div :style="headerStyle">
      <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
        <Trophy :size="18" stroke-width="1.5" />
        <span :style="titleStyle">Classifica</span>
      </div>
      <button :style="closeBtnStyle" @click="emit('close')" aria-label="Chiudi">
        <X :size="18" stroke-width="2" />
      </button>
    </div>

    <!-- Contenuto -->
    <div>
      <!-- Riga kisses passivi (solo se possiede territori) -->
      <div v-if="pixelCount > 0" :style="passiveRowStyle">
        <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
          <KissesIcon :size="16" />
          <div>
            <div :style="{ fontFamily:FF.label, fontSize:'20px', fontWeight:800, color:C.gold, lineHeight:1 }">
              +{{ accumulated }}
              <span v-if="lastEarned" :style="{ color:C.ok, fontSize:'13px' }"> ✓ +{{ lastEarned }} riscossi!</span>
            </div>
            <div :style="passiveSubStyle">
              +{{ effectivePixels * rate }}/ora · prossima tra {{ formatTime(nextIn) }}
            </div>
          </div>
        </div>
        <button :disabled="claiming || accumulated === 0" :style="claimBtnStyle" @click.stop="claim">
          {{ claiming ? '…' : 'CLAIM' }}
        </button>
      </div>

      <!-- Classifica -->
      <div :style="{ padding:'10px 16px 14px' }">
        <div :style="rankTitleStyle">Classifica Territori</div>
        <div :style="rankListStyle">
          <div v-if="leaders.length === 0" :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-3)' }">
            Nessun territorio conquistato ancora
          </div>
          <template v-else>
            <div
              v-for="(l, i) in leaders"
              :key="l.uid"
              :style="leaderRowStyle(l.uid === userUid)"
            >
              <span :style="rankNumStyle">#{{ i + 1 }}</span>
              <div :style="dotStyle(l.color, l.uid === userUid)" />
              <span :style="leaderNameStyle(l.uid === userUid)">{{ l.name }}</span>
              <span :style="leaderCountStyle(l.uid === userUid)">{{ l.count }}</span>
            </div>
          </template>
          <!-- CPU row -->
          <div :style="{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 8px' }">
            <span :style="{ fontFamily:FF.label, fontSize:'14px', color:'var(--theme-text-3)', minWidth:'28px' }" />
            <div :style="{ width:'10px', height:'10px', borderRadius:'3px', background:'#888', flexShrink:0 }" />
            <span :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:700, color:'var(--theme-text-3)', flex:1 }">CPU</span>
            <span :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:800, color:'var(--theme-text-3)' }">{{ cpuCount }}</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Trophy (Lucide) nell'header della classifica, X per chiudere la modale
import { Trophy, X } from 'lucide-vue-next'
import type { CSSProperties } from 'vue'
// Classifica mini mappa con kisses passivi, countdown e toggle espansione
const authStore = useAuthStore()

interface ChunkPixel { ownerId: string; ownerName: string; ownerColor: string }
interface Chunk { pixels?: Record<string, ChunkPixel> }
interface Profilo { pixelCount?: number; kisses?: number; lastKissesClaimAt?: { toMillis?: () => number } }

const props = defineProps<{
  open:         boolean
  chunks:       Record<string, Chunk> | null
  userUid:      string
  profilo:      Profilo | null
  passiveRate?: number
}>()

const emit = defineEmits<{
  kissesUpdate: [amount: number]
  claimAt:      [timestamp: number]
  close:        []
}>()

const C = { gold:'#f5c560', goldL:'#ffe9a8', sakura:'#ff85b6', aqua:'#6cf0e0', violet:'#a78bfa', ok:'#58e0a3', err:'#ff5b6c' }
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}

const pixelCount      = computed(() => props.profilo?.pixelCount ?? 0)
const rate            = computed(() => props.passiveRate ?? 1)
const effectivePixels = computed(() => Math.floor(pixelCount.value / 2))
const ratePerSec      = computed(() => (effectivePixels.value * rate.value) / 3600)

const leaders = computed(() => {
  const counts: Record<string, number> = {}
  const names:  Record<string, string> = {}
  const colors: Record<string, string> = {}
  if (!props.chunks) return []
  for (const chunk of Object.values(props.chunks)) {
    if (!chunk.pixels) continue
    for (const data of Object.values(chunk.pixels)) {
      if (data.ownerId === 'CPU') continue
      counts[data.ownerId] = (counts[data.ownerId] ?? 0) + 1
      names[data.ownerId]  = data.ownerName
      colors[data.ownerId] = data.ownerColor
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([uid, count]) => ({ uid, count, name: names[uid], color: colors[uid] }))
})

const cpuCount = computed(() => {
  if (!props.chunks) return 0
  let c = 0
  for (const chunk of Object.values(props.chunks)) {
    if (!chunk.pixels) continue
    for (const data of Object.values(chunk.pixels)) { if (data.ownerId === 'CPU') c++ }
  }
  return c
})

const claiming         = ref(false)
const lastEarned       = ref<number | null>(null)
const accumulated      = ref(0)
const nextIn           = ref(0)
const localLastClaimAt = ref<number | null>(null)

let interval: ReturnType<typeof setInterval> | null = null

const startTick = () => {
  if (interval) clearInterval(interval)
  const tick = () => {
    const serverTs  = props.profilo?.lastKissesClaimAt?.toMillis?.() ?? (Date.now() - 3_600_000)
    const lastClaim = localLastClaimAt.value ? Math.max(serverTs, localLastClaimAt.value) : serverTs
    const elapsed   = (Date.now() - lastClaim) / 1000
    accumulated.value = Math.floor(elapsed * ratePerSec.value)
    nextIn.value = Math.max(0, Math.round(3600 - (elapsed % 3600)))
  }
  tick()
  interval = setInterval(tick, 1000)
}

watch(
  () => [pixelCount.value, ratePerSec.value, props.profilo?.lastKissesClaimAt, localLastClaimAt.value],
  () => { if (pixelCount.value > 0) startTick() },
  { immediate: true },
)
onUnmounted(() => { if (interval) clearInterval(interval) })

const claim = async () => {
  if (claiming.value || pixelCount.value === 0 || accumulated.value === 0) return
  claiming.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const data  = await ($fetch('/api/mappa/passive-kisses/claim', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })) as { earned: number }
    if (data.earned > 0) {
      const nowMs = Date.now()
      lastEarned.value = data.earned
      emit('kissesUpdate', data.earned)
      localLastClaimAt.value = nowMs
      accumulated.value = 0
      emit('claimAt', nowMs)
      setTimeout(() => { lastEarned.value = null }, 3000)
    }
  } finally { claiming.value = false }
}

const formatTime = (seconds: number): string => {
  if (seconds <= 0) return 'ora!'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── Stili — tutti con CSS variables per supporto light/dark ───────────────────
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: '0', zIndex: 500,
  background: 'var(--theme-overlay)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
}
const wrapperStyle: CSSProperties = {
  position: 'relative',
  width: '100%', maxWidth: '400px',
  maxHeight: '82vh', overflowY: 'auto',
  background: 'var(--theme-surface)',
  border: '1px solid var(--theme-border)',
  borderRadius: '18px',
  boxShadow: '0 12px 40px var(--theme-shadow)',
}
const headerStyle: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 16px 12px',
  borderBottom: '1px solid var(--theme-border)',
}
const titleStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '16px', fontWeight: 700,
  letterSpacing: '0.18em', color: 'var(--theme-text)', textTransform: 'uppercase',
}
const closeBtnStyle: CSSProperties = {
  flexShrink: 0, width: '32px', height: '32px',
  background: 'transparent', border: '1px solid var(--theme-border)',
  borderRadius: '50%', cursor: 'pointer',
  display: 'grid', placeItems: 'center', color: 'var(--theme-text-3)',
}
const passiveRowStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--theme-border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
}
const passiveSubStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.1em',
  color: 'var(--theme-text-3)', textTransform: 'uppercase', marginTop: '2px',
}
const claimBtnStyle = computed((): CSSProperties => ({
  background: accumulated.value > 0 ? 'var(--theme-accent)' : 'var(--theme-shimmer)',
  border: `1.5px solid ${accumulated.value > 0 ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
  borderRadius: '999px',
  color: accumulated.value > 0 ? '#F0ECF8' : 'var(--theme-text-3)',
  fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase',
  padding: '9px 20px', cursor: accumulated.value > 0 ? 'pointer' : 'not-allowed',
  fontWeight: 700, flexShrink: 0,
  boxShadow: accumulated.value > 0 ? '0 4px 12px var(--theme-shadow)' : 'none',
}))
const rankTitleStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.22em',
  color: 'var(--theme-text-3)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700,
}
const rankListStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '3px',
}
const leaderRowStyle = (isMe: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '6px 8px', borderRadius: '9px',
  background: isMe ? 'var(--theme-tab-active)' : 'transparent',
  border: isMe ? '1px solid var(--theme-accent)' : '1px solid transparent',
})
const rankNumStyle: CSSProperties = {
  fontFamily: FF.label, fontSize: '14px', fontWeight: 700, color: 'var(--theme-text-3)', minWidth: '28px', textAlign: 'right',
}
const dotStyle = (color: string, isMe: boolean): CSSProperties => ({
  width: '10px', height: '10px', borderRadius: '50%',
  background: color || '#888', flexShrink: 0,
  border: isMe ? '1.5px solid var(--theme-accent)' : 'none',
  boxShadow: isMe ? `0 0 6px ${color}88` : 'none',
})
const leaderNameStyle = (isMe: boolean): CSSProperties => ({
  fontFamily: FF.label, fontSize: '16px', fontWeight: 700, letterSpacing: '0.05em',
  color: isMe ? 'var(--theme-accent)' : 'var(--theme-text)',
  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})
const leaderCountStyle = (isMe: boolean): CSSProperties => ({
  fontFamily: FF.label, fontSize: '16px', fontWeight: 800,
  color: isMe ? 'var(--theme-accent)' : 'var(--theme-text-2)',
})
</script>
