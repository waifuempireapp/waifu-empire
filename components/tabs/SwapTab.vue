<!-- Tab Swap: sistema di votazione waifu con guadagno Kisses e classifica settimanale -->
<script setup lang="ts">
import { listDropsAttivi } from '~/utils/firestoreService'

const props = defineProps<{
  user: any
  profilo: any
}>()
const emit = defineEmits<{
  profiloUpdate: [partial: Record<string, any>]
  setTab: [tab: string]
}>()

const queue = ref<any[]>([])
const currentIdx = ref(0)
const swapConfig = ref<any>(null)
const loading = ref(true)
const toast = ref<any>(null)
const milestone = ref<any>(null)
const showAd = ref(false)
const exhausted = ref(false)
const howExpanded = ref(false)
const swapStatus = ref<any>(null)
const filtroEspansione = ref<string | null>(null)
const dropsAttivi = ref<any[]>([])
const seenIds = ref(new Set<string>())
const loadingBatch = ref(false)

async function loadBatch() {
  if (loadingBatch.value) return
  loadingBatch.value = true
  try {
    const token = await props.user?.getIdToken()
    const exclude = Array.from(seenIds.value).join(',')
    const params = new URLSearchParams()
    if (exclude) params.set('exclude', exclude)
    if (filtroEspansione.value) params.set('espansione_id', filtroEspansione.value)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const data: any = await $fetch(`/api/swap/batch${qs}`, { headers: { Authorization: `Bearer ${token}` } })
    let waifu: any[] = data.waifu || []
    if (data.exhausted || waifu.length === 0) { exhausted.value = true; return }
    if (!props.profilo?.hardPass) waifu = waifu.filter((w: any) => !w.hot)
    queue.value = [...queue.value, ...waifu]
    if (data.exhausted) exhausted.value = true
  } catch (e) { console.error(e) }
  finally { loadingBatch.value = false }
}

async function loadConfig() {
  try {
    const token = await props.user?.getIdToken()
    swapConfig.value = await $fetch('/api/swap/config', { headers: { Authorization: `Bearer ${token}` } })
  } catch { /* usa defaults */ }
}

async function loadStatus() {
  try {
    const token = await props.user?.getIdToken()
    swapStatus.value = await $fetch('/api/swap/status', { headers: { Authorization: `Bearer ${token}` } })
  } catch { /* ignora */ }
}

async function handleVote(direction: 'like' | 'dislike') {
  const waifu = queue.value[currentIdx.value]
  if (!waifu) return
  seenIds.value.add(waifu.id)
  currentIdx.value++

  try {
    const token = await props.user?.getIdToken()
    const data: any = await $fetch('/api/swap/vote', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { waifuId: waifu.id, vote: direction === 'like' ? 'like' : 'dislike' },
    })
    if (swapStatus.value) {
      swapStatus.value = {
        ...swapStatus.value,
        dailyVotes: (swapStatus.value.dailyVotes ?? 0) + 1,
        votesRemaining: swapStatus.value.votesRemaining != null
          ? Math.max(0, swapStatus.value.votesRemaining - 1) : null,
      }
    }
    const todayItaly = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' })
    const isNewDay = (props.profilo?.daily_swap_date ?? '') !== todayItaly
    emit('profiloUpdate', {
      totalVotes: data.totalVotes ?? (props.profilo?.totalVotes ?? 0) + 1,
      swipeCount: data.swipeCount ?? (props.profilo?.swipeCount ?? 0) + 1,
      daily_swap_votes: isNewDay ? 1 : (props.profilo?.daily_swap_votes ?? 0) + 1,
      daily_swap_date: todayItaly,
    })
    if (data.kissesEarned > 0) {
      toast.value = { amount: data.kissesEarned, streakDays: data.streakDays, multiplier: data.multiplier }
      emit('profiloUpdate', { kisses: (props.profilo?.kisses ?? 0) + data.kissesEarned })
    }
    if (data.milestoneHit && data.milestoneEarned > 0) {
      milestone.value = { milestone: data.milestoneHit, amount: data.milestoneEarned }
      emit('profiloUpdate', { kisses: (props.profilo?.kisses ?? 0) + data.milestoneEarned })
    }
    if (data.showAd) { showAd.value = true; loadBatch() }
  } catch (e: any) {
    if (e?.response?.status === 429 || e?.statusCode === 429) {
      const d = e?.data ?? {}
      const resetTime = d.resetAt ? new Date(d.resetAt) : null
      const resetHH = resetTime ? `${String(resetTime.getHours()).padStart(2,'0')}:${String(resetTime.getMinutes()).padStart(2,'0')}` : '00:00'
      toast.value = { type: 'limit', message: `Limite giornaliero (${d.dailyLimit} voti). Riprova alle ${resetHH}.` }
    }
  }
}

watch(filtroEspansione, () => {
  queue.value = []; currentIdx.value = 0; seenIds.value = new Set(); exhausted.value = false
  loadBatch()
})
watch([currentIdx, () => queue.value.length], () => {
  const remaining = queue.value.length - currentIdx.value
  if (remaining < 3 && !exhausted.value && !loadingBatch.value) loadBatch()
})

onMounted(async () => {
  dropsAttivi.value = await listDropsAttivi().catch(() => [])
  await Promise.all([loadBatch(), loadConfig(), loadStatus()])
  loading.value = false
})

const currentWaifu = computed(() => queue.value[currentIdx.value])
const remaining = computed(() => queue.value.length - currentIdx.value)
const isLimitReached = computed(() => swapStatus.value && !swapStatus.value.hasSwapPass && swapStatus.value.votesRemaining === 0)
const ownershipBadge = computed(() => {
  const w = currentWaifu.value
  if (!w) return null
  if (w._owned) return 'owned'
  if (w._seen) return 'seen'
  return 'new'
})
const BADGE_STYLE: Record<string, any> = {
  owned: { bg:'rgba(6,214,160,0.2)', border:'rgba(6,214,160,0.5)', color:'#06d6a0', label:'✓ Già tua' },
  seen:  { bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.4)', color:'#f59e0b', label:'👁 Già vista' },
  new:   { bg:'rgba(174,156,255,0.12)', border:'rgba(174,156,255,0.3)', color:'#a78bfa', label:'✨ Nuova!' },
}

function resetQueue() {
  queue.value = []; currentIdx.value = 0; seenIds.value = new Set(); exhausted.value = false; loadBatch()
}

// Countdown mezzanotte Roma per schermata limite voti
const countdown = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null
watch(isLimitReached, (v) => {
  if (!v) return
  const tick = () => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' })
    const [yr, mo, dy] = todayStr.split('-').map(Number)
    const base = Date.UTC(yr, mo - 1, dy, 21, 0, 0)
    let midnightRome = new Date(base + 3 * 3600000)
    for (let i = 0; i < 4; i++) {
      const t = base + i * 3600000
      if (new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' }) > todayStr) { midnightRome = new Date(t); break }
    }
    const diff = Math.max(0, midnightRome.getTime() - now.getTime())
    const hh = Math.floor(diff / 3600000)
    const mm = Math.floor((diff % 3600000) / 60000)
    const ss = Math.floor((diff % 60000) / 1000)
    countdown.value = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  }
  tick()
  countdownInterval = setInterval(tick, 1000)
})
onUnmounted(() => { if (countdownInterval) clearInterval(countdownInterval) })
</script>

<template>
  <!-- Caricamento iniziale -->
  <div v-if="loading" style="display:flex;flex-direction:column;min-height:70vh;align-items:center;justify-content:center">
    <div style="font-size:40px;color:#ff85b6;animation:pulse 1.2s ease-in-out infinite">🩷</div>
    <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.22em;color:rgba(174,156,255,0.5);margin-top:12px;text-transform:uppercase">Caricamento…</div>
  </div>

  <!-- Schermata limite voti giornalieri -->
  <div v-else-if="isLimitReached" style="display:flex;flex-direction:column;min-height:80vh;align-items:center;justify-content:center;padding:24px;text-align:center;gap:20px">
    <div style="font-size:56px">🚫</div>
    <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:20px;color:#ff85b6;font-weight:800">Limite voti raggiunto</div>
    <div style="font-size:13px;color:rgba(241,235,255,0.6);line-height:1.6;max-width:320px">
      Hai usato tutti i voti giornalieri. Il contatore si azzera a mezzanotte (ora italiana).
    </div>
    <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:28px;color:#f5c560;font-weight:700;font-variant-numeric:tabular-nums">
      {{ countdown }}
    </div>
    <button @click="$emit('setTab', 'negozio')" style="padding:14px 28px;background:linear-gradient(135deg,#ec4899,#a855f7);border:none;border-radius:14px;color:#fff;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.1em">
      <KissesIcon :size="13" /> Acquista Swap Pass — Voti illimitati
    </button>
    <button @click="$emit('setTab', 'home')" style="background:transparent;border:none;color:rgba(241,235,255,0.4);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;cursor:pointer">← Torna alla Home</button>
  </div>

  <!-- Contenuto principale -->
  <div v-else style="position:relative;min-height:80vh;display:flex;flex-direction:column">
    <!-- Header: navigazione + kisses -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button @click="$emit('setTab', 'home')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(174,156,255,0.2);border-radius:10px;color:rgba(241,235,255,0.7);padding:7px 12px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer">← Home</button>
        <div>
          <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;letter-spacing:0.22em;color:#ff85b6;text-transform:uppercase">🩷 SWAP</div>
          <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:20px;color:#fff;font-weight:800">Waifu Swap</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        <div style="display:flex;align-items:center;gap:6px">
          <KissesIcon :size="16" />
          <span style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;color:#f5c560;font-weight:700">{{ profilo?.kisses ?? 0 }}</span>
        </div>
        <div v-if="swapStatus" :style="{ fontFamily:'var(--ff-label)', fontSize:'9px', letterSpacing:'0.1em', color: swapStatus.hasSwapPass ? 'rgba(6,214,160,0.8)' : swapStatus.votesRemaining === 0 ? 'rgba(255,91,108,0.8)' : 'rgba(241,235,255,0.4)' }">
          {{ swapStatus.hasSwapPass ? '♾ voti illimitati' : `${swapStatus.dailyVotes}/${swapStatus.dailyLimit} voti oggi` }}
        </div>
      </div>
    </div>

    <!-- Banner "Come funziona" -->
    <div style="margin-bottom:14px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,133,182,0.15);background:linear-gradient(135deg,rgba(255,133,182,0.07),rgba(167,139,250,0.05))">
      <button @click="howExpanded = !howExpanded" style="width:100%;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px">
          <span>ℹ️</span>
          <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.2em;color:#ff85b6;text-transform:uppercase">Come funziona</span>
        </div>
        <span :style="{ display:'inline-block', transition:'transform 0.2s', transform: howExpanded ? 'rotate(180deg)' : 'rotate(0)', color:'rgba(241,235,255,0.45)', fontSize:'9px' }">▼</span>
      </button>
      <div v-if="howExpanded" style="padding:0 16px 14px;display:flex;flex-direction:column;gap:8px">
        <div v-for="item in [
          { icon:'👆', text:'Scorri le carte e vota con ♥ o ✕' },
          { icon:'🩷', text:'Ogni 10 voti guadagni Kisses' },
          { icon:'🔥', text:'Streak giornalieri moltiplicano i Kisses' },
          { icon:'🏆', text:'Le waifu più votate scalano la classifica settimanale' },
        ]" :key="item.text" style="display:flex;align-items:flex-start;gap:8px">
          <span style="font-size:14px;flex-shrink:0">{{ item.icon }}</span>
          <span style="font-size:11px;color:rgba(241,235,255,0.65);line-height:1.4">{{ item.text }}</span>
        </div>
      </div>
    </div>

    <!-- Streak -->
    <div v-if="(profilo?.streakDays ?? 0) > 1" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;background:rgba(108,240,224,0.08);border:1px solid rgba(108,240,224,0.2);border-radius:10px;padding:6px 12px;align-self:flex-start">
      <span>🔥</span>
      <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.15em;color:#6cf0e0;text-transform:uppercase">
        {{ profilo.streakDays }} giorni · ×{{ Math.min(1 + (profilo.streakDays - 1) * 0.1, 3).toFixed(1) }}
      </span>
    </div>

    <!-- Filtro espansione -->
    <div v-if="dropsAttivi.length > 0" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      <button @click="filtroEspansione = null" :style="{ padding:'4px 12px', borderRadius:'999px', border:`1px solid ${!filtroEspansione ? '#ff85b6' : 'rgba(255,133,182,0.3)'}`, background: !filtroEspansione ? 'rgba(255,133,182,0.15)' : 'transparent', color: !filtroEspansione ? '#ff85b6' : 'rgba(241,235,255,0.5)', fontFamily:'var(--ff-label)', fontSize:'9px', cursor:'pointer' }">Tutte</button>
      <button v-for="d in dropsAttivi" :key="d.id" @click="filtroEspansione = d.id === filtroEspansione ? null : d.id"
        :style="{ padding:'4px 12px', borderRadius:'999px', border:`1px solid ${filtroEspansione === d.id ? '#f5c560' : 'rgba(245,197,96,0.25)'}`, background: filtroEspansione === d.id ? 'rgba(245,197,96,0.12)' : 'transparent', color: filtroEspansione === d.id ? '#f5c560' : 'rgba(241,235,255,0.4)', fontFamily:'var(--ff-label)', fontSize:'9px', cursor:'pointer' }">
        {{ d.nome || d.id }}
      </button>
    </div>

    <!-- Carta corrente -->
    <div v-if="currentWaifu" style="flex:1;display:flex;flex-direction:column;align-items:center">
      <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:10px;color:rgba(241,235,255,0.3);margin-bottom:12px">
        #{{ seenIds.size + 1 }} — swipa per votare
        <span v-if="remaining <= 3 && !exhausted" style="color:rgba(108,240,224,0.5);margin-left:8px">⟳ caricamento…</span>
      </div>
      <!-- Badge stato + espansione -->
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px">
        <div v-if="ownershipBadge" :style="{ background:BADGE_STYLE[ownershipBadge].bg, border:`1px solid ${BADGE_STYLE[ownershipBadge].border}`, color:BADGE_STYLE[ownershipBadge].color, borderRadius:'999px', padding:'4px 14px', fontFamily:'var(--ff-label)', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em' }">
          {{ BADGE_STYLE[ownershipBadge].label }}
        </div>
        <div v-if="currentWaifu?.espansione_nome" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:#f59e0b;border-radius:999px;padding:4px 12px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px">
          📦 {{ currentWaifu.espansione_nome }}
        </div>
      </div>
      <SwapSwapCard
        :key="currentWaifu?.id ?? currentIdx"
        :waifu="currentWaifu"
        :expansion-name="currentWaifu?.espansione_nome ?? null"
        @vote="handleVote"
      />
    </div>

    <!-- Esaurite -->
    <div v-else-if="exhausted" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
      <div style="font-size:56px">✨</div>
      <div style="font-size:15px;color:rgba(241,235,255,0.5);text-align:center">Hai visto tutte le waifu!<br/>Torna presto per nuove aggiunte.</div>
      <button @click="resetQueue" style="padding:12px 24px;background:rgba(255,133,182,0.12);border:1px solid rgba(255,133,182,0.3);border-radius:12px;color:#ff85b6;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer">↺ Ricarica</button>
    </div>

    <!-- Loading carta -->
    <div v-else style="flex:1;display:flex;align-items:center;justify-content:center">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.22em;color:rgba(174,156,255,0.4);text-transform:uppercase">Caricamento waifu…</div>
    </div>

    <!-- Overlays -->
    <SwapSwapRewardToast v-if="toast" v-bind="toast" @done="toast = null" />
    <SwapSwapMilestoneModal v-if="milestone" v-bind="milestone" @close="milestone = null" />
    <SwapAdSlot v-if="showAd" @close="showAd = false" />
  </div>
</template>
