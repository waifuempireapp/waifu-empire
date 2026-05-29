<template>
  <!-- Mini classifica territori con contatore kisses passivi e pulsante claim -->
  <div :style="wrapperStyle">
    <!-- Riga 1: Passive kisses (visibile solo se si possiedono territori) -->
    <div v-if="pixelCount > 0" :style="passiveRowStyle">
      <div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
        <KissesIcon :size="14" />
        <div>
          <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: C.gold }">
            +{{ accumulated }}
            <span v-if="lastEarned" :style="{ color: C.ok }">✓ +{{ lastEarned }} riscossi!</span>
          </div>
          <div :style="passiveSubStyle">
            +{{ effectivePixels * rate }}/ora · prossima ora tra {{ formatTime(nextIn) }}
          </div>
        </div>
      </div>
      <button :disabled="claiming || accumulated === 0" :style="claimBtnStyle" @click="claim">
        {{ claiming ? '…' : 'Claim' }}
      </button>
    </div>

    <!-- Riga 2: Classifica territori -->
    <div :style="{ padding: '8px 16px' }">
      <div :style="rankTitleStyle">Classifica Territori</div>
      <div :style="rankListStyle">
        <div v-if="leaders.length === 0" :style="{ fontFamily: FF.body, fontSize: '11px', color: 'rgba(241,235,255,0.3)' }">
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
        <!-- Riga CPU -->
        <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 6px' }">
          <span :style="{ fontFamily: FF.mono, fontSize: '10px', color: 'rgba(174,156,255,0.3)', minWidth: '20px' }" />
          <div :style="{ width: '8px', height: '8px', borderRadius: '2px', background: '#888888', flexShrink: 0 }" />
          <span :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(241,235,255,0.3)', flex: 1 }">CPU</span>
          <span :style="{ fontFamily: FF.mono, fontSize: '11px', color: 'rgba(174,156,255,0.4)' }">{{ cpuCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Classifica mini mappa con kisses passivi e countdown al prossimo accumulo
const authStore = useAuthStore()

interface ChunkPixel {
  ownerId: string
  ownerName: string
  ownerColor: string
}
interface Chunk {
  pixels?: Record<string, ChunkPixel>
}
interface Profilo {
  pixelCount?: number
  kisses?: number
  lastKissesClaimAt?: { toMillis?: () => number }
}

const props = defineProps<{
  chunks: Record<string, Chunk> | null
  userUid: string
  profilo: Profilo | null
  passiveRate?: number
}>()

const emit = defineEmits<{
  kissesUpdate: [amount: number]
  claimAt: [timestamp: number]
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

const pixelCount     = computed(() => props.profilo?.pixelCount ?? 0)
const rate           = computed(() => props.passiveRate ?? 1)
const effectivePixels = computed(() => Math.floor(pixelCount.value / 2))
const ratePerSec     = computed(() => (effectivePixels.value * rate.value) / 3600)

// Classifica calcolata dai chunks
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

// Contatore CPU
const cpuCount = computed(() => {
  if (!props.chunks) return 0
  let c = 0
  for (const chunk of Object.values(props.chunks)) {
    if (!chunk.pixels) continue
    for (const data of Object.values(chunk.pixels)) { if (data.ownerId === 'CPU') c++ }
  }
  return c
})

// Stato claim kisses passivi
const claiming        = ref(false)
const lastEarned      = ref<number | null>(null)
const accumulated     = ref(0)
const nextIn          = ref(0)
const localLastClaimAt = ref<number | null>(null)

// Tick ogni secondo per aggiornare kisses accumulati e countdown
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
    const data = await $fetch<{ earned: number }>('/api/mappa/passive-kisses/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (data.earned > 0) {
      const nowMs = Date.now()
      lastEarned.value = data.earned
      emit('kissesUpdate', data.earned)
      localLastClaimAt.value = nowMs
      accumulated.value = 0
      emit('claimAt', nowMs)
      setTimeout(() => { lastEarned.value = null }, 3000)
    }
  } finally {
    claiming.value = false
  }
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

// Stili
const wrapperStyle = {
  background: 'rgba(13,10,38,0.9)',
  borderTop: '1px solid rgba(174,156,255,0.12)',
  borderBottom: '1px solid rgba(174,156,255,0.12)',
}
const passiveRowStyle = {
  padding: '8px 16px',
  borderBottom: '1px solid rgba(174,156,255,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
}
const passiveSubStyle = {
  fontFamily: FF.label, fontSize: '8px', letterSpacing: '0.12em',
  color: 'rgba(241,235,255,0.35)', textTransform: 'uppercase', marginTop: '1px',
}
const claimBtnStyle = computed(() => ({
  background: accumulated.value > 0 ? 'rgba(245,197,96,0.15)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${accumulated.value > 0 ? 'rgba(245,197,96,0.4)' : 'rgba(174,156,255,0.1)'}`,
  borderRadius: '8px', color: accumulated.value > 0 ? C.gold : 'rgba(241,235,255,0.25)',
  fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
  padding: '6px 14px', cursor: accumulated.value > 0 ? 'pointer' : 'not-allowed',
}))
const rankTitleStyle = {
  fontFamily: FF.label, fontSize: '8px', letterSpacing: '0.2em',
  color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase', marginBottom: '6px',
}
const rankListStyle = {
  display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto',
}
const leaderRowStyle = (isMe: boolean) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '3px 6px', borderRadius: '7px',
  background: isMe ? 'rgba(245,197,96,0.06)' : 'transparent',
  border: isMe ? '1px solid rgba(245,197,96,0.15)' : '1px solid transparent',
})
const rankNumStyle = {
  fontFamily: FF.mono, fontSize: '10px', color: 'rgba(174,156,255,0.5)', minWidth: '20px', textAlign: 'right',
}
const dotStyle = (color: string, isMe: boolean) => ({
  width: '8px', height: '8px', borderRadius: '50%',
  background: color || '#888', flexShrink: 0,
  border: isMe ? `1px solid ${C.gold}` : 'none',
})
const leaderNameStyle = (isMe: boolean) => ({
  fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.1em',
  color: isMe ? C.goldL : 'rgba(241,235,255,0.7)',
  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})
const leaderCountStyle = (isMe: boolean) => ({
  fontFamily: FF.mono, fontSize: '11px',
  color: isMe ? C.gold : 'rgba(174,156,255,0.7)', fontWeight: 700,
})
</script>
