<!-- Tab Swap: sistema di votazione waifu con guadagno Kisses e classifica settimanale -->
<script setup lang="ts">
import SwapCard from '~/components/swap/SwapCard.vue'
import { Ban, Sparkles, Heart } from 'lucide-vue-next'
import SwapRewardToast from '~/components/swap/SwapRewardToast.vue'
import SwapMilestoneModal from '~/components/swap/SwapMilestoneModal.vue'
import AdSlot from '~/components/swap/AdSlot.vue'
import { listDropsAttivi } from '~/utils/firestoreService'
import { ikUrl } from '~/utils/imagekitUrl'
import { useMissionsStore } from '~/stores/missions'

const { t } = useI18n()

// Precarica le immagini delle waifu in coda così non si caricano "realtime"
// quando l'utente arriva alla carta (stesso URL/preset usato da SwapCard).
function preloadWaifuImages(list: any[]) {
  if (typeof window === 'undefined') return
  for (const w of list) {
    const src = w?.asset_immagine || w?.asset_statica || w?.asset_immersiva
    const url = src ? ikUrl(src, 'normal') : null
    if (url) { const img = new Image(); img.decoding = 'async'; img.src = url }
  }
}

const props = defineProps<{
  user: any
  profilo: any
}>()
const emit = defineEmits<{
  profiloUpdate: [partial: Record<string, any>]
  setTab: [tab: string]
}>()

const missionsStore = useMissionsStore()

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
    preloadWaifuImages(waifu)   // precarica subito le immagini del nuovo batch
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
    missionsStore.trackAction('swipe_waifu')
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

// ── Contatore voti giornalieri (label fissa in basso) ────────────────────────
const hasSwapPass = computed(() => !!(swapStatus.value?.hasSwapPass) || !!props.profilo?.hardPass)
const voteCount   = computed(() => swapStatus.value?.dailyVotes ?? (props.profilo?.daily_swap_votes as number) ?? 0)
const voteLimit   = computed(() => {
  const rem = swapStatus.value?.votesRemaining
  if (typeof rem === 'number') return (swapStatus.value?.dailyVotes ?? 0) + rem
  return swapConfig.value?.dailyLimit ?? 50
})
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
  <AppLoading v-if="loading" fullscreen />

  <!-- Popup limite voti giornalieri (fine swipe) — vero modale: backdrop che
       blocca i click dietro, solo i due bottoni sono cliccabili. -->
  <div v-else-if="isLimitReached" class="swap-limit-overlay">
    <div class="swap-limit-card">
      <Ban :size="46" stroke-width="1.5" style="color:#ff5b6c;opacity:0.9;" />
      <div class="swap-limit-title">{{ $t('swap.limit_reached') }}</div>
      <div class="swap-limit-desc">{{ $t('swap.limit_explanation') }}</div>
      <div class="swap-limit-timer">{{ countdown }}</div>
      <div class="swap-limit-actions">
        <button class="swap-limit-btn swap-limit-btn--ghost" @click="$emit('setTab', 'home')">
          {{ $t('swap.back_to_home') }}
        </button>
        <button class="swap-limit-btn swap-limit-btn--primary" @click="$emit('setTab', 'negozio')">
          <KissesIcon :size="13" /> {{ $t('swap.buy_pass') }}
        </button>
      </div>
    </div>
  </div>

  <!-- Card waifu centrata -->
  <div v-else class="swap-arena">

    <!-- X: chiude lo swipe e torna alla home (il footer qui è nascosto) -->
    <button
      class="swap-close-x"
      aria-label="Chiudi"
      @click="$emit('setTab', 'home')"
    >✕</button>

    <SwapCard
      v-if="currentWaifu"
      :key="currentWaifu?.id ?? currentIdx"
      :waifu="currentWaifu"
      :expansion-name="currentWaifu?.espansione_nome ?? null"
      @vote="handleVote"
    />

    <!-- Hai visto tutto -->
    <div v-else-if="exhausted" class="swap-exhausted">
      <Sparkles :size="56" stroke-width="1.5" style="color:#f5c560;opacity:0.85;" />
      <div class="swap-exhausted-text">{{ t('swap.all_seen') }}<br/>{{ t('swap.come_back_soon') }}</div>
      <button @click="resetQueue" class="swap-btn-reload">{{ t('swap.reload') }}</button>
    </div>

    <!-- Caricamento batch -->
    <AppLoading v-else />

    <!-- Contatore voti giornalieri — fisso in basso (∞ con Swap/Hard Pass) -->
    <div class="swap-vote-counter">
      <Heart :size="13" stroke-width="2" style="color:#ff4d9e;" />
      <span><b>{{ voteCount }}</b> / <span v-if="hasSwapPass" class="swap-vote-inf">∞</span><span v-else>{{ voteLimit }}</span></span>
    </div>

    <!-- Overlays -->
    <SwapRewardToast v-if="toast" v-bind="toast" @done="toast = null" />
    <SwapMilestoneModal v-if="milestone" v-bind="milestone" @close="milestone = null" />
    <AdSlot v-if="showAd" @close="showAd = false" />
  </div>
</template>

<style scoped>
.swap-close-x {
  position: fixed;
  top: calc(14px + env(safe-area-inset-top));
  right: 14px;
  z-index: 80;
  width: 40px; height: 40px;
  display: grid; place-items: center;
  padding: 0; line-height: 1;
  background: var(--grad-primary-soft), var(--theme-surface);
  border: 1px solid var(--theme-border-2);
  border-radius: 12px;
  color: var(--theme-text-2);
  font-size: 16px; cursor: pointer;
  box-shadow: 0 4px 14px var(--theme-shadow);
}

/* ── Popup limite voti (vero modale con backdrop) ─────────────────────── */
.swap-limit-overlay {
  position: fixed; inset: 0; z-index: 100000;
  background: var(--theme-overlay, rgba(4,2,14,0.72));
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.swap-limit-card {
  width: 100%; max-width: 340px;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 20px;
  box-shadow: 0 16px 48px var(--theme-shadow, rgba(0,0,0,0.5));
  padding: 28px 22px 22px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  text-align: center;
  animation: swapLimitPop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes swapLimitPop {
  from { opacity: 0; transform: translateY(14px) scale(0.94); }
  to   { opacity: 1; transform: none; }
}
.swap-limit-title {
  font-family: var(--ff-display, 'Fredoka', sans-serif);
  font-size: 19px; font-weight: 800;
  color: var(--theme-accent-pink);
}
.swap-limit-desc {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 13px; color: var(--theme-text-2, var(--text-secondary));
  line-height: 1.55; max-width: 300px;
}
.swap-limit-timer {
  font-family: var(--ff-mono, 'JetBrains Mono', monospace);
  font-size: 26px; font-weight: 700;
  color: var(--accent-gold, #f5c560);
  font-variant-numeric: tabular-nums;
  margin-bottom: 2px;
}
.swap-limit-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px; }
.swap-limit-btn {
  width: 100%; padding: 13px 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
}
.swap-limit-btn--ghost {
  background: transparent; border: 1px solid var(--theme-border);
  color: var(--theme-text-3, var(--text-tertiary));
}
.swap-limit-btn--primary {
  border: none; color: #fff;
  background: var(--grad-primary, linear-gradient(135deg, #ec4899, #a855f7));
  box-shadow: 0 6px 18px rgba(168, 85, 247, 0.4);
}

.swap-arena {
  /* Senza header ne' footer: la card e' centrata nell'INTERO viewport */
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 0 16px;
}

/* Contatore voti giornalieri — fisso in basso al centro */
.swap-vote-counter {
  position: fixed;
  bottom: calc(18px + env(safe-area-inset-bottom));
  left: 50%; transform: translateX(-50%);
  z-index: 20; pointer-events: none;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 999px;
  background: var(--theme-surface, rgba(20,16,34,0.9));
  border: 1px solid var(--theme-border);
  box-shadow: 0 6px 20px var(--theme-shadow, rgba(0,0,0,0.4));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-size: 14px; font-weight: 700; letter-spacing: 0.04em;
  color: var(--theme-text-2, #cfc6e6);
  font-variant-numeric: tabular-nums;
}
.swap-vote-counter b { color: var(--theme-text, #fff); font-weight: 900; }
.swap-vote-inf { font-size: 17px; line-height: 1; color: #ff4d9e; font-weight: 900; }

.swap-exhausted {
  display: flex; flex-direction: column;
  align-items: center; gap: 16px;
  padding: 24px; text-align: center;
}
.swap-exhausted-text {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 15px; color: var(--text-secondary);
}
.swap-btn-reload {
  padding: 12px 24px;
  background: var(--accent-soft);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-pill);
  color: var(--accent);
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  cursor: pointer;
}
</style>
