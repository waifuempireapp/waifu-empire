<!-- Tab Swap: sistema di votazione waifu con guadagno Kisses e classifica settimanale -->
<script setup lang="ts">
import SwapCard from '~/components/swap/SwapCard.vue'
import SwapRewardToast from '~/components/swap/SwapRewardToast.vue'
import SwapMilestoneModal from '~/components/swap/SwapMilestoneModal.vue'
import AdSlot from '~/components/swap/AdSlot.vue'
import { listDropsAttivi } from '~/utils/firestoreService'

const { t } = useI18n()

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
  <div v-if="loading" style="display:flex;flex-direction:column;min-height:70vh;align-items:center;justify-content:center;">
    <img src="~/assets/images/New_Logo.png" alt="" style="width:80px;height:auto;animation:pulse 1.2s ease-in-out infinite;opacity:0.85;" />
    <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.22em;color:rgba(174,156,255,0.5);margin-top:12px;text-transform:uppercase">{{ $t('swap.loading') }}</div>
  </div>

  <!-- Schermata limite voti giornalieri -->
  <div v-else-if="isLimitReached" style="display:flex;flex-direction:column;min-height:80vh;align-items:center;justify-content:center;padding:24px;text-align:center;gap:20px">
    <div style="font-size:56px">🚫</div>
    <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:20px;color:#ff85b6;font-weight:800">{{ $t('swap.limit_reached') }}</div>
    <div style="font-size:13px;color:rgba(241,235,255,0.6);line-height:1.6;max-width:320px">{{ $t('swap.limit_explanation') }}</div>
    <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:28px;color:#f5c560;font-weight:700;font-variant-numeric:tabular-nums">
      {{ countdown }}
    </div>
    <button @click="$emit('setTab', 'negozio')" style="padding:14px 28px;background:linear-gradient(135deg,#ec4899,#a855f7);border:none;border-radius:14px;color:#fff;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.1em">
      <KissesIcon :size="13" /> {{ $t('swap.buy_pass') }}
    </button>
    <button @click="$emit('setTab', 'home')" style="background:transparent;border:none;color:rgba(241,235,255,0.4);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;cursor:pointer">{{ $t('swap.back_to_home') }}</button>
  </div>

  <!-- Card waifu centrata — SOLO card + ♥/✕ -->
  <div v-else style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;">

    <SwapCard
      v-if="currentWaifu"
      :key="currentWaifu?.id ?? currentIdx"
      :waifu="currentWaifu"
      :expansion-name="currentWaifu?.espansione_nome ?? null"
      @vote="handleVote"
    />

    <!-- Hai visto tutto -->
    <div v-else-if="exhausted" style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;text-align:center;">
      <div style="font-size:56px">✨</div>
      <div style="font-size:15px;color:rgba(241,235,255,0.5);">Hai visto tutte le waifu!<br/>Torna presto.</div>
      <button @click="resetQueue" style="padding:12px 24px;background:rgba(255,133,182,0.12);border:1px solid rgba(255,133,182,0.3);border-radius:12px;color:#ff85b6;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">↺ Ricarica</button>
    </div>

    <!-- Caricamento -->
    <div v-else style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.22em;color:rgba(174,156,255,0.4);text-transform:uppercase;">Caricamento waifu…</div>

    <!-- Overlays (reward toast, milestone, ad) -->
    <SwapRewardToast v-if="toast" v-bind="toast" @done="toast = null" />
    <SwapMilestoneModal v-if="milestone" v-bind="milestone" @close="milestone = null" />
    <AdSlot v-if="showAd" @close="showAd = false" />
  </div>
</template>
