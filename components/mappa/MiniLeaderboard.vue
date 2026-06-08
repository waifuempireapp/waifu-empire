<template>
  <!-- Classifica territori con kisses passivi, espandibile -->
  <div :style="wrapperStyle">

    <!-- Header cliccabile per espandere/collassare -->
    <button :style="headerStyle" @click="expanded = !expanded">
      <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
        <Trophy :size="16" stroke-width="1.5" />
        <span :style="titleStyle">Classifica</span>
        <span v-if="pixelCount > 0 && accumulated > 0" :style="badgeStyle">
          <KissesIcon :size="12" /> +{{ accumulated }}
        </span>
      </div>
      <span :style="{ fontSize:'16px', color:'rgba(174,156,255,0.5)', transition:'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }">▾</span>
    </button>

    <!-- Contenuto espandibile -->
    <div v-if="expanded">
      <!-- Riga kisses passivi (solo se possiede territori) -->
      <div v-if="pixelCount > 0" :style="passiveRowStyle">
        <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
          <KissesIcon :size="16" />
          <div>
            <div :style="{ fontFamily:FF.mono, fontSize:'16px', fontWeight:700, color:C.gold, lineHeight:1 }">
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
          <div v-if="leaders.length === 0" :style="{ fontFamily:FF.body, fontSize:'13px', color:'rgba(241,235,255,0.3)' }">
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
            <span :style="{ fontFamily:FF.mono, fontSize:'11px', color:'rgba(174,156,255,0.3)', minWidth:'24px' }" />
            <div :style="{ width:'10px', height:'10px', borderRadius:'3px', background:'#888', flexShrink:0 }" />
            <span :style="{ fontFamily:FF.label, fontSize:'13px', color:'rgba(241,235,255,0.3)', flex:1 }">CPU</span>
            <span :style="{ fontFamily:FF.mono, fontSize:'13px', color:'rgba(174,156,255,0.4)' }">{{ cpuCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Trophy (Lucide) sostituisce l'emoji 🏆 nell'header della classifica
import { Trophy } from 'lucide-vue-next'
// Classifica mini mappa con kisses passivi, countdown e toggle espansione
const authStore = useAuthStore()

interface ChunkPixel { ownerId: string; ownerName: string; ownerColor: string }
interface Chunk { pixels?: Record<string, ChunkPixel> }
interface Profilo { pixelCount?: number; kisses?: number; lastKissesClaimAt?: { toMillis?: () => number } }

const props = defineProps<{
  chunks:       Record<string, Chunk> | null
  userUid:      string
  profilo:      Profilo | null
  passiveRate?: number
}>()

const emit = defineEmits<{
  kissesUpdate: [amount: number]
  claimAt:      [timestamp: number]
}>()

// Stato espansione (default: collassato)
const expanded = ref(false)

const C = { gold:'#f5c560', goldL:'#ffe9a8', sakura:'#ff85b6', aqua:'#6cf0e0', violet:'#a78bfa', ok:'#58e0a3', err:'#ff5b6c' }
const FF = { display:"'Cinzel', serif", label:"'Saira Condensed', sans-serif", body:"'Inter', sans-serif", mono:"'JetBrains Mono', monospace" }

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
    const data  = await $fetch<{ earned: number }>('/api/mappa/passive-kisses/claim', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
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

// ── Stili ─────────────────────────────────────────────────────────────────────
const wrapperStyle = {
  background: 'rgba(13,10,38,0.92)',
  borderTop: '1px solid rgba(174,156,255,0.12)',
  borderBottom: '1px solid rgba(174,156,255,0.12)',
  margin: '0 16px 12px',
  borderRadius: '14px',
  overflow: 'hidden',
}
const headerStyle = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
}
const titleStyle = {
  fontFamily: FF.label, fontSize: '16px', fontWeight: 700,
  letterSpacing: '0.18em', color: 'rgba(245,197,96,0.85)', textTransform: 'uppercase',
}
const badgeStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  background: 'rgba(245,197,96,0.12)', border: '1px solid rgba(245,197,96,0.3)',
  borderRadius: '999px', padding: '2px 10px',
  fontFamily: FF.mono, fontSize: '12px', fontWeight: 700, color: '#f5c560',
}
const passiveRowStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(174,156,255,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
}
const passiveSubStyle = {
  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.1em',
  color: 'rgba(241,235,255,0.4)', textTransform: 'uppercase', marginTop: '2px',
}
const claimBtnStyle = computed(() => ({
  background: accumulated.value > 0 ? 'linear-gradient(135deg,rgba(245,197,96,0.22),rgba(245,197,96,0.1))' : 'rgba(255,255,255,0.04)',
  border: `1.5px solid ${accumulated.value > 0 ? 'rgba(245,197,96,0.55)' : 'rgba(174,156,255,0.1)'}`,
  borderRadius: '999px',
  color: accumulated.value > 0 ? '#f5c560' : 'rgba(241,235,255,0.25)',
  fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase',
  padding: '9px 20px', cursor: accumulated.value > 0 ? 'pointer' : 'not-allowed',
  fontWeight: 700, flexShrink: 0,
  boxShadow: accumulated.value > 0 ? '0 0 14px rgba(245,197,96,0.2)' : 'none',
}))
const rankTitleStyle = {
  fontFamily: FF.label, fontSize: '12px', letterSpacing: '0.22em',
  color: 'rgba(174,156,255,0.5)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700,
}
const rankListStyle = {
  display: 'flex', flexDirection: 'column', gap: '3px',
}
const leaderRowStyle = (isMe: boolean) => ({
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '6px 8px', borderRadius: '9px',
  background: isMe ? 'rgba(245,197,96,0.07)' : 'transparent',
  border: isMe ? '1px solid rgba(245,197,96,0.18)' : '1px solid transparent',
})
const rankNumStyle = {
  fontFamily: FF.mono, fontSize: '12px', color: 'rgba(174,156,255,0.55)', minWidth: '24px', textAlign: 'right' as const,
}
const dotStyle = (color: string, isMe: boolean) => ({
  width: '10px', height: '10px', borderRadius: '50%',
  background: color || '#888', flexShrink: 0,
  border: isMe ? '1.5px solid #f5c560' : 'none',
  boxShadow: isMe ? `0 0 6px ${color}88` : 'none',
})
const leaderNameStyle = (isMe: boolean) => ({
  fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.08em',
  color: isMe ? '#ffe9a8' : 'rgba(241,235,255,0.75)',
  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
})
const leaderCountStyle = (isMe: boolean) => ({
  fontFamily: FF.mono, fontSize: '14px',
  color: isMe ? '#f5c560' : 'rgba(174,156,255,0.8)', fontWeight: 700,
})
</script>
