<!-- ============================================================
  ScambiList: gestione completa degli scambi waifu.
  Include i modal inline: TradeIncomingModal, TradePendingConfirmModal,
  TradeBConfirmModal e TradeReceiveAnimation (senza componenti separati
  per semplificare la migrazione da React).
  API: /api/trades/list, /api/trades/cancel, /api/trades/respond,
       /api/trades/accept, /api/trades/confirm, /api/trades/seen
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// ------------------------------------------------------------------ Props
const props = defineProps<{
  profilo: any
  collezione: any
  waifuCat: any[]
  initialData: { trades: any[]; pendingCount: number } | null
}>()

const emit = defineEmits<{
  badgeChange: [n: number]
  refresh: []
  collectionRefresh: []
}>()

// ------------------------------------------------------------------ Costanti
const RARITA_COLORI: Record<string, string> = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
}

const DAILY_LIMIT = 5
const TRADES_PER_PAGE = 10

// ------------------------------------------------------------------ Store & stato
const authStore = useAuthStore()
const { t } = useI18n()

const trades = ref<any[]>(props.initialData?.trades ?? [])
const loading = ref(!props.initialData)
const errore = ref<string | null>(null)
const page = ref(0)

// Modal aperto corrente: { trade, tipo: 'incoming' | 'accept' | 'confirm_b' }
const tradeAperto = ref<{ trade: any; tipo: string } | null>(null)

// Animazione ricezione waifu: { waifu, isNew, tradeId, forUid }
const animazione = ref<{ waifu: any; isNew: boolean; tradeId: string; forUid: string } | null>(null)

// Traccia gli ID di trade completati già visualizzati in questa sessione
const viewedCompletedIds = ref<Set<string>>(new Set())

// ------------------------------------------------------------------ Countdown reset scambi
const countdownRemaining = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

const aggiornaCountdown = (tradesResetAt: any) => {
  let target: Date | null = null
  if (tradesResetAt?.toDate) target = tradesResetAt.toDate()
  else if (tradesResetAt?.seconds) target = new Date(tradesResetAt.seconds * 1000)
  else if (tradesResetAt) target = new Date(tradesResetAt)
  if (!target) { countdownRemaining.value = ''; return }
  const diff = target.getTime() - Date.now()
  if (diff <= 0) { countdownRemaining.value = 'in aggiornamento…'; return }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  countdownRemaining.value = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

const avviaCountdown = () => {
  if (countdownTimer) clearInterval(countdownTimer)
  const tradesResetAt = props.profilo?.tradesResetAt
  if (!tradesResetAt) return
  aggiornaCountdown(tradesResetAt)
  countdownTimer = setInterval(() => aggiornaCountdown(tradesResetAt), 1000)
}

onUnmounted(() => { if (countdownTimer) clearInterval(countdownTimer) })

// ------------------------------------------------------------------ Helpers
const getStatusLabel = (trade: any, uid: string) => {
  const isA = trade.fromUid === uid
  const isB = trade.toUid === uid
  switch (trade.status) {
    case 'waifu_a_scelta':
      return isA
        ? { text: t('trades.st_waifu_offered'), color: '#f5a623' }
        : { text: t('trades.st_proposal_received'), color: '#f5a623', action: true }
    case 'waifu_b_scelta':
      return isA
        ? { text: t('trades.st_response_accept_reject'), color: '#42a5f5', action: true }
        : { text: t('trades.st_proposal_sent_a'), color: '#9e9e9e' }
    case 'a_accettato':
      return isA
        ? { text: t('trades.st_accepted_waiting_b'), color: '#9e9e9e' }
        : { text: t('trades.st_a_accepted_confirm'), color: '#00e676', action: true }
    case 'b_accettato':
      return isB
        ? { text: t('trades.st_trade_done'), color: '#00e676', action: true }
        : { text: t('trades.st_b_confirmed'), color: '#9e9e9e' }
    case 'completato':
      return isA
        ? { text: t('trades.st_almost_done'), color: '#00e676', action: true }
        : { text: t('trades.st_completed_waiting_a'), color: '#9e9e9e' }
    case 'chiuso':           return { text: t('trades.st_completed_check'), color: '#9e9e9e' }
    case 'pending_response': return { text: t('trades.st_pending_response'), color: '#f5a623' }
    case 'pending_confirm':
      return isA
        ? { text: t('trades.st_response_accept'), color: '#42a5f5', action: true }
        : { text: t('trades.st_pending_confirm'), color: '#9e9e9e' }
    case 'completed':  return { text: t('trades.st_completed'), color: '#00e676' }
    case 'cancelled':  return { text: t('trades.st_cancelled'), color: '#9e9e9e' }
    case 'expired':    return { text: t('trades.st_expired'), color: '#ff4d4d' }
    default:           return { text: trade.status, color: '#9e9e9e' }
  }
}

// ------------------------------------------------------------------ Carica lista scambi
const carica = async () => {
  loading.value = true
  errore.value = null
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/trades/list', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { trades: any[]; error?: string }
    const fetchedTrades: any[] = (data as any).trades || []
    trades.value = fetchedTrades

    const uid = authStore.user?.uid || ''

    // Animazione per B: b_accettato non ancora visto
    const needsAnimB = fetchedTrades.filter(
      t => t.status === 'b_accettato' && t.toUid === uid && !viewedCompletedIds.value.has(t.id + '_b')
    )
    // Animazione per A: completato non ancora visto
    const needsAnimA = fetchedTrades.filter(
      t => t.status === 'completato' && t.fromUid === uid && !viewedCompletedIds.value.has(t.id + '_a')
    )

    // Calcolo badge: azioni richieste dall'utente
    const needsAction = fetchedTrades.filter(t => {
      if (t.status === 'waifu_a_scelta' && t.toUid === uid) return true
      if (t.status === 'waifu_b_scelta' && t.fromUid === uid) return true
      if (t.status === 'a_accettato' && t.toUid === uid) return true
      if (t.status === 'b_accettato' && t.toUid === uid) return true
      if (t.status === 'completato' && t.fromUid === uid) return true
      if (t.status === 'pending_response' && t.toUid === uid) return true
      if (t.status === 'pending_confirm' && t.fromUid === uid) return true
      if (t.status === 'completed' && !t.seenByFromUid && t.fromUid === uid) return true
      if (t.status === 'completed' && !t.seenByToUid && t.toUid === uid) return true
      return false
    }).length
    emit('badgeChange', needsAction)

    // Avvia animazione per B (b_accettato)
    if (needsAnimB.length > 0 && !animazione.value && !tradeAperto.value) {
      const trade = needsAnimB[0]
      const received = props.waifuCat.find(w => w.id === trade.fromWaifuId)
      viewedCompletedIds.value = new Set([...viewedCompletedIds.value, trade.id + '_b'])
      if (received) {
        animazione.value = {
          waifu: received,
          isNew: !props.collezione?.waifu?.[trade.fromWaifuId],
          tradeId: trade.id,
          forUid: 'b',
        }
        return
      }
    }
    // Avvia animazione per A (completato)
    if (needsAnimA.length > 0 && !animazione.value && !tradeAperto.value) {
      const trade = needsAnimA[0]
      const received = props.waifuCat.find(w => w.id === trade.toWaifuId)
      viewedCompletedIds.value = new Set([...viewedCompletedIds.value, trade.id + '_a'])
      if (received) {
        animazione.value = {
          waifu: received,
          isNew: !props.collezione?.waifu?.[trade.toWaifuId],
          tradeId: trade.id,
          forUid: 'a',
        }
      }
    }
  } catch (e: any) {
    errore.value = e?.data?.error || e?.message || t('trades.error_load')
  } finally {
    loading.value = false
  }
}

// Apre il modal corretto in base allo stato del trade e al ruolo dell'utente
const apriTrade = (trade: any) => {
  const uid = authStore.user?.uid || ''
  if ((trade.status === 'waifu_a_scelta' || trade.status === 'pending_response') && trade.toUid === uid) {
    tradeAperto.value = { trade, tipo: 'incoming' }
  } else if ((trade.status === 'waifu_b_scelta' || trade.status === 'pending_confirm') && trade.fromUid === uid) {
    tradeAperto.value = { trade, tipo: 'accept' }
  } else if (trade.status === 'a_accettato' && trade.toUid === uid) {
    tradeAperto.value = { trade, tipo: 'confirm_b' }
  } else if (trade.status === 'completato' && trade.fromUid === uid) {
    const received = props.waifuCat.find(w => w.id === trade.toWaifuId)
    viewedCompletedIds.value = new Set([...viewedCompletedIds.value, trade.id + '_a'])
    if (received) {
      animazione.value = {
        waifu: received,
        isNew: !props.collezione?.waifu?.[trade.toWaifuId],
        tradeId: trade.id,
        forUid: 'a',
      }
    }
  } else if (trade.status === 'b_accettato' && trade.toUid === uid) {
    const received = props.waifuCat.find(w => w.id === trade.fromWaifuId)
    viewedCompletedIds.value = new Set([...viewedCompletedIds.value, trade.id + '_b'])
    if (received) {
      animazione.value = {
        waifu: received,
        isNew: !props.collezione?.waifu?.[trade.fromWaifuId],
        tradeId: trade.id,
        forUid: 'b',
      }
    }
  }
}

// Callback dopo azione su un trade: chiude il modal e ricarica
const onTradeDone = () => {
  tradeAperto.value = null
  carica()
}

// Marca lo scambio come visto dall'utente corrente
const marcaVisto = async (tradeId: string) => {
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/seen', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId },
    })
  } catch { /* non critico */ }
}

// Callback dopo che l'animazione di ricezione è completata
const onAnimazioneCompleta = async () => {
  if (animazione.value?.tradeId) {
    await marcaVisto(animazione.value.tradeId)
  }
  animazione.value = null
  emit('collectionRefresh')
  carica()
}

// ------------------------------------------------------------------ Computed
const uid = computed(() => authStore.user?.uid || '')

const attivi = computed(() =>
  trades.value.filter(t => !['chiuso', 'cancelled', 'expired'].includes(t.status))
)
const terminati = computed(() =>
  trades.value.filter(t => ['chiuso', 'cancelled', 'expired', 'completed'].includes(t.status))
)
const totalPages = computed(() => Math.ceil(terminati.value.length / TRADES_PER_PAGE))
const terminatiPagina = computed(() =>
  terminati.value.slice(page.value * TRADES_PER_PAGE, (page.value + 1) * TRADES_PER_PAGE)
)

const haTradePass = computed(() => props.profilo?.tradePass === true)
const tradesToday = computed(() => props.profilo?.tradesToday ?? 0)
const tradesResetAt = computed(() => props.profilo?.tradesResetAt)

// Waifu di B compatibili per rispondere allo scambio (stessa rarità, ≥2 copie)
const incomingTrade = computed(() => tradeAperto.value?.trade)
const incomingRarita = computed(() => incomingTrade.value?.rarita)
const incomingColore = computed(() => RARITA_COLORI[incomingRarita.value] || '#f5a623')
const incomingFromCat = computed(() =>
  incomingTrade.value ? props.waifuCat.find(w => w.id === incomingTrade.value.fromWaifuId) : null
)
const enrichedIncomingTrade = computed(() => {
  if (!incomingTrade.value) return null
  return {
    ...incomingTrade.value,
    fromWaifuNome: incomingFromCat.value?.nome || incomingTrade.value.fromWaifuId,
    fromWaifuImmagine:
      incomingFromCat.value?.asset_statica ||
      incomingFromCat.value?.asset_immersiva ||
      incomingFromCat.value?.immagine ||
      null,
  }
})

const incomingLimitRaggiunto = computed(() => !haTradePass.value && tradesToday.value >= DAILY_LIMIT)
const incomingScambiRimasti = computed(() =>
  haTradePass.value ? null : Math.max(0, DAILY_LIMIT - tradesToday.value)
)
const mieWaifuCompatibili = computed(() => {
  if (!incomingRarita.value) return []
  return Object.entries(props.collezione?.waifu || {})
    .filter(([id, d]: [string, any]) => {
      const catalog = props.waifuCat.find(w => w.id === id)
      return catalog?.rarita === incomingRarita.value && (d.copie ?? 0) >= 2
    })
    .map(([id, d]: [string, any]) => {
      const catalog = props.waifuCat.find(w => w.id === id)
      return {
        id, ...d,
        rarita: catalog?.rarita,
        nome: catalog?.nome || id,
        immagine: catalog?.asset_statica || catalog?.asset_immersiva || catalog?.immagine || null,
      }
    })
})

// TradeReceiveAnimation state
const animFlipped = ref(false)
const animDone = ref(false)
let animTimer1: ReturnType<typeof setTimeout> | null = null
let animTimer2: ReturnType<typeof setTimeout> | null = null
const animColore = computed(() => RARITA_COLORI[animazione.value?.waifu?.rarita || ''] || '#ff4d9e')

// Modal incoming - selezione waifu
const incomingWaifuSelId = ref<string | null>(null)
const incomingStato = ref<'idle' | 'loading' | 'success' | 'error' | 'cancelled'>('idle')
const incomingErrMsg = ref('')

// Modal accept (TradePendingConfirmModal)
const acceptStato = ref<'idle' | 'loading' | 'success' | 'cancelled' | 'error'>('idle')
const acceptErrMsg = ref('')
const acceptTrade = computed(() => tradeAperto.value?.trade)
const acceptFromCatalog = computed(() => props.waifuCat.find(w => w.id === acceptTrade.value?.fromWaifuId))
const acceptToCatalog = computed(() => props.waifuCat.find(w => w.id === acceptTrade.value?.toWaifuId))
const acceptColore = computed(() => RARITA_COLORI[acceptTrade.value?.rarita] || '#f5a623')

// Modal confirm_b (TradeBConfirmModal)
const confirmStato = ref<'idle' | 'loading' | 'success' | 'cancelled' | 'error'>('idle')
const confirmErrMsg = ref('')
const confirmTrade = computed(() => tradeAperto.value?.trade)
const confirmFromCatalog = computed(() => props.waifuCat.find(w => w.id === confirmTrade.value?.fromWaifuId))
const confirmToCatalog = computed(() => props.waifuCat.find(w => w.id === confirmTrade.value?.toWaifuId))
const confirmColore = computed(() => RARITA_COLORI[confirmTrade.value?.rarita] || '#f5a623')
const confirmFromImg = computed(() =>
  confirmFromCatalog.value?.asset_statica || confirmFromCatalog.value?.asset_immersiva || confirmFromCatalog.value?.immagine || null
)
const confirmToImg = computed(() =>
  confirmToCatalog.value?.asset_statica || confirmToCatalog.value?.asset_immersiva || confirmToCatalog.value?.immagine || null
)
const confirmFromNome = computed(() => confirmFromCatalog.value?.nome || confirmTrade.value?.fromWaifuId || '?')
const confirmToNome = computed(() => confirmToCatalog.value?.nome || confirmTrade.value?.toWaifuId || '?')
const confirmIsNewWaifu = computed(() => !props.collezione?.waifu?.[confirmTrade.value?.fromWaifuId])
const confirmBReceivedByB = ref<any>(null)

// ------------------------------------------------------------------ Azioni modal incoming
const incomingRispondi = async () => {
  if (!incomingWaifuSelId.value || incomingStato.value === 'loading') return
  incomingStato.value = 'loading'
  incomingErrMsg.value = ''
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/respond', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: incomingTrade.value.id, toWaifuId: incomingWaifuSelId.value },
    })
    incomingStato.value = 'success'
    setTimeout(() => { tradeAperto.value = null; incomingStato.value = 'idle'; carica() }, 1500)
  } catch (e: any) {
    incomingErrMsg.value = e?.data?.error || e?.message || t('trades.error_response')
    incomingStato.value = 'idle'
  }
}

const incomingRifiuta = async () => {
  incomingStato.value = 'loading'
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: incomingTrade.value.id },
    })
    incomingStato.value = 'cancelled'
    setTimeout(() => { tradeAperto.value = null; incomingStato.value = 'idle'; carica() }, 1200)
  } catch { incomingStato.value = 'idle' }
}

// ------------------------------------------------------------------ Azioni modal accept
const acceptAccetta = async () => {
  if (acceptStato.value === 'loading') return
  acceptStato.value = 'loading'
  acceptErrMsg.value = ''
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: acceptTrade.value.id },
    })
    acceptStato.value = 'success'
    setTimeout(() => { tradeAperto.value = null; acceptStato.value = 'idle'; carica() }, 1200)
  } catch (e: any) {
    acceptErrMsg.value = e?.data?.error || e?.message || t('trades.error_accept')
    acceptStato.value = 'idle'
  }
}

const acceptAnnulla = async () => {
  acceptStato.value = 'loading'
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: acceptTrade.value.id },
    })
    acceptStato.value = 'cancelled'
    setTimeout(() => { tradeAperto.value = null; acceptStato.value = 'idle'; carica() }, 1200)
  } catch { acceptStato.value = 'idle' }
}

// ------------------------------------------------------------------ Azioni modal confirm_b
const confirmConferma = async () => {
  if (confirmStato.value === 'loading') return
  confirmStato.value = 'loading'
  confirmErrMsg.value = ''
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/trades/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: confirmTrade.value.id },
    })) as any
    const received = (data as any).receivedByB || confirmFromCatalog.value || {
      id: confirmTrade.value.fromWaifuId,
      nome: confirmFromNome.value,
      rarita: confirmTrade.value.rarita,
      immagine: confirmFromImg.value,
    }
    confirmBReceivedByB.value = received
    confirmStato.value = 'success'
  } catch (e: any) {
    confirmErrMsg.value = e?.data?.error || e?.message || t('trades.error_confirm')
    confirmStato.value = 'idle'
  }
}

const confirmAnnulla = async () => {
  confirmStato.value = 'loading'
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: confirmTrade.value.id },
    })
    confirmStato.value = 'cancelled'
    setTimeout(() => { tradeAperto.value = null; confirmStato.value = 'idle'; carica() }, 1200)
  } catch { confirmStato.value = 'idle' }
}

const onConfirmBAnimazioneCompleta = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/trades/seen', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { tradeId: confirmTrade.value?.id },
    })
  } catch { /* non critico */ }
  tradeAperto.value = null
  confirmStato.value = 'idle'
  confirmBReceivedByB.value = null
  emit('collectionRefresh')
  carica()
}

// ------------------------------------------------------------------ Watch per avviare countdown
watch(() => props.profilo?.tradesResetAt, avviaCountdown, { immediate: true })

// Quando si apre il modal incoming, reset selezione waifu
watch(() => tradeAperto.value, (val) => {
  if (!val) {
    incomingWaifuSelId.value = null
    incomingStato.value = 'idle'
    incomingErrMsg.value = ''
    acceptStato.value = 'idle'
    acceptErrMsg.value = ''
    confirmStato.value = 'idle'
    confirmErrMsg.value = ''
    confirmBReceivedByB.value = null
  }
})

// Avvia timer animazione ricezione waifu
watch(animazione, (val) => {
  if (animTimer1) clearTimeout(animTimer1)
  if (animTimer2) clearTimeout(animTimer2)
  animFlipped.value = false
  animDone.value = false
  if (val) {
    animTimer1 = setTimeout(() => { animFlipped.value = true }, 800)
    animTimer2 = setTimeout(() => { animDone.value = true }, 2200)
  }
})

// ------------------------------------------------------------------ Mount: carica iniziale
onMounted(() => {
  if (props.initialData) {
    emit('badgeChange', props.initialData.pendingCount || 0)
    loading.value = false
  } else {
    carica()
  }
})

onUnmounted(() => {
  if (animTimer1) clearTimeout(animTimer1)
  if (animTimer2) clearTimeout(animTimer2)
})
</script>

<template>
  <!-- ======================================================
       ANIMAZIONE RICEZIONE WAIFU (b_accettato / completato)
       ====================================================== -->
  <div
    v-if="animazione"
    class="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-7"
    style="background: var(--theme-overlay);"
  >
    <div
      style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 4px; color: #ff4d9e; opacity: 0.8;"
    >
      {{ animDone ? '✦ WAIFU RICEVUTA ✦' : 'IN ARRIVO…' }}
    </div>

    <!-- Carta flip -->
    <div class="card-flip-container" style="width: 120px; height: 168px;">
      <div :class="['card-inner', animFlipped ? 'flipped' : '']" style="width: 120px; height: 168px;">
        <!-- Retro carta -->
        <div
          class="card-face back flex items-center justify-center"
          style="width: 120px; height: 168px; background: linear-gradient(145deg, #120825, #0d0618); border: 2px solid rgba(245,166,35,0.35);"
        >
          <div class="absolute inset-1" style="border: 1px solid rgba(245,166,35,0.15); border-radius: 5px;" />
          <img src="~/assets/images/New_Logo.png" alt="" style="width:100%;height:100%;object-fit:contain;opacity:0.85;" />
        </div>
        <!-- Fronte carta -->
        <div class="card-face front overflow-hidden" style="width: 120px; height: 168px;">
          <template v-if="animazione.waifu?.asset_statica || animazione.waifu?.asset_immersiva || animazione.waifu?.immagine">
            <img
              :src="animazione.waifu.asset_statica || animazione.waifu.asset_immersiva || animazione.waifu.immagine"
              :alt="animazione.waifu.nome"
              style="width: 120px; height: 168px; object-fit: cover; border-radius: 6px;"
            />
          </template>
          <div v-else class="flex items-center justify-center w-full h-full" :style="{ fontSize: '40px', color: animColore }">◈</div>
        </div>
      </div>
    </div>

    <!-- Info waifu + bottone continua -->
    <div v-if="animDone && animazione.waifu" class="fade-up text-center" style="max-width: 280px;">
      <div
        style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 2px; margin-bottom: 6px;"
        :style="{ color: animColore, textShadow: `0 0 12px ${animColore}80` }"
      >
        {{ animazione.waifu.rarita?.toUpperCase() }}
      </div>
      <div style="font-family: 'Fredoka', sans-serif; font-size: 19px; color: #eedcd4; margin-bottom: 4px;">
        {{ animazione.waifu.nome }}
      </div>
      <div style="font-size: 10px; color: rgba(238,232,220,0.4); font-family: 'Orbitron', sans-serif; letter-spacing: 1px;">
        Aggiunta alla tua collezione
      </div>
      <button
        @click="onAnimazioneCompleta"
        :style="{
          marginTop: '18px',
          background: `${animColore}20`,
          border: `1px solid ${animColore}60`,
          borderRadius: '22px',
          color: animColore,
          fontFamily: '\'Orbitron\', sans-serif',
          fontSize: '10px',
          padding: '11px 32px',
          cursor: 'pointer',
          letterSpacing: '2px',
        }"
      >{{ $t("trades.continue") }}</button>
    </div>
  </div>

  <!-- ======================================================
       MODAL: RICHIESTA SCAMBIO IN ARRIVO (B sceglie la waifu)
       ====================================================== -->
  <div
    v-else-if="tradeAperto?.tipo === 'incoming'"
    class="fixed inset-0 z-[400] flex flex-col items-center overflow-y-auto px-4 py-6 gap-4"
    style="background: var(--theme-overlay); backdrop-filter: blur(20px);"
  >
    <!-- Feedback: risposta inviata -->
    <div
      v-if="incomingStato === 'success'"
      class="flex flex-col items-center justify-center gap-3 w-full h-full"
    >
      <div style="font-size: 40px;">✅</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: #00e676; letter-spacing: 2px;">{{ $t("trades.response_sent") }}</div>
      <div style="font-family: 'Fredoka', sans-serif; font-size: 12px; color: rgba(238,232,220,0.6);">
        {{ enrichedIncomingTrade?.fromName }} deve ora confermare lo scambio.
      </div>
    </div>

    <!-- Feedback: scambio rifiutato -->
    <div
      v-else-if="incomingStato === 'cancelled'"
      class="flex flex-col items-center justify-center gap-3 w-full h-full"
    >
      <div style="font-size: 40px;">❌</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: rgba(238,232,220,0.5); letter-spacing: 2px;">{{ $t("trades.trade_rejected") }}</div>
    </div>

    <!-- Form selezione waifu -->
    <div v-else style="width: 100%; max-width: 440px;">
      <div class="flex items-center justify-between mb-4">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 3px; color: #ff4d9e;">{{ $t("trades.trade_request") }}</div>
        <button
          @click="tradeAperto = null"
          style="background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: rgba(238,232,220,0.5); font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 6px 12px; cursor: pointer;"
        >✕</button>
      </div>

      <div style="font-family: 'Fredoka', sans-serif; font-size: 13px; color: rgba(238,232,220,0.7); margin-bottom: 14px;">
        <strong style="color: #ff4d9e;">{{ enrichedIncomingTrade?.fromName }}</strong> vuole scambiare questa waifu con te:
      </div>

      <!-- Waifu offerta da A -->
      <div
        class="flex gap-3 items-center rounded-xl p-[14px] mb-5"
        :style="{
          background: `${incomingColore}0a`,
          border: `1px solid ${incomingColore}30`,
        }"
      >
        <img
          v-if="enrichedIncomingTrade?.fromWaifuImmagine"
          :src="enrichedIncomingTrade.fromWaifuImmagine"
          :alt="enrichedIncomingTrade.fromWaifuNome"
          style="width: 56px; height: 78px; object-fit: cover; border-radius: 6px;"
          :style="{ border: `1px solid ${incomingColore}40` }"
        />
        <div>
          <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '12px', color: incomingColore, fontWeight: 700 }">
            {{ enrichedIncomingTrade?.fromWaifuNome }}
          </div>
          <div style="font-family: 'Fredoka', sans-serif; font-size: 11px; color: rgba(238,232,220,0.5); margin-top: 2px;">
            Rarità: <span :style="{ color: incomingColore }">{{ incomingRarita }}</span>
          </div>
        </div>
      </div>

      <!-- Banner limite giornaliero -->
      <div
        class="flex items-center justify-between rounded-[10px] px-[14px] py-2 mb-1"
        style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);"
      >
        <div style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: rgba(238,232,220,0.4); letter-spacing: 1px;">{{ $t("trades.trades_today") }}</div>
        <div v-if="haTradePass" style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: #00e676;">{{ $t("trades.unlimited") }}</div>
        <div v-else style="font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700;">
          <span :style="{ color: incomingLimitRaggiunto ? '#ff4d4d' : '#eedcd4' }">{{ tradesToday }}</span>
          <span style="color: rgba(238,232,220,0.35);">/{{ DAILY_LIMIT }}</span>
          <span v-if="!incomingLimitRaggiunto" style="color: #00e676; margin-left: 6px; font-size: 8px;">({{ incomingScambiRimasti }} rimasti)</span>
        </div>
      </div>

      <!-- Alert limite raggiunto -->
      <div
        v-if="incomingLimitRaggiunto"
        class="rounded-[10px] px-[14px] py-[10px] mb-1"
        style="background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3);"
      >
        <div style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: #ff4d4d; font-weight: 700;">{{ $t("trades.limit_reached") }}</div>
        <div style="font-family: 'Fredoka', sans-serif; font-size: 11px; color: rgba(238,232,220,0.5); margin-top: 2px;">
          Hai esaurito i tuoi {{ DAILY_LIMIT }} scambi giornalieri. Puoi solo rifiutare questo scambio.
        </div>
      </div>

      <!-- Intestazione griglia selezione waifu -->
      <div
        v-if="!incomingLimitRaggiunto"
        style="font-family: 'Orbitron', sans-serif; font-size: 9px; letter-spacing: 2px; color: rgba(238,232,220,0.4); margin-bottom: 10px;"
      >
        SCEGLI LA TUA WAIFU DA OFFRIRE IN CAMBIO (stessa rarità: {{ incomingRarita }} · min. 2 copie)
      </div>

      <!-- Nessuna waifu compatibile -->
      <div
        v-if="!incomingLimitRaggiunto && mieWaifuCompatibili.length === 0"
        class="text-center rounded-xl p-5"
        style="background: rgba(255,77,158,0.05); border: 1px solid rgba(255,77,158,0.15);"
      >
        <div style="font-family: 'Orbitron', sans-serif; font-size: 10px; color: rgba(238,232,220,0.4);">
          Non hai waifu di rarità <strong :style="{ color: incomingColore }">{{ incomingRarita }}</strong> con almeno 2 copie da offrire.
        </div>
        <div style="font-family: 'Fredoka', sans-serif; font-size: 11px; color: rgba(238,232,220,0.3); margin-top: 4px;">{{ $t("trades.can_reject") }}</div>
      </div>

      <!-- Griglia waifu compatibili -->
      <div
        v-else-if="!incomingLimitRaggiunto"
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 10px; max-height: 340px; overflow-y: auto;"
      >
        <div
          v-for="w in mieWaifuCompatibili"
          :key="w.id"
          @click="incomingWaifuSelId = w.id"
          :style="{
            cursor: 'pointer',
            position: 'relative',
            outline: incomingWaifuSelId === w.id ? `3px solid ${incomingColore}` : 'none',
            borderRadius: '10px',
            boxShadow: incomingWaifuSelId === w.id ? `0 0 16px ${incomingColore}60` : 'none',
            transition: 'all 0.15s',
            transform: incomingWaifuSelId === w.id ? 'scale(1.04)' : 'scale(1)',
          }"
        >
          <img
            v-if="w.immagine"
            :src="w.immagine"
            :alt="w.nome"
            style="width: 105px; height: 155px; object-fit: cover; border-radius: 8px;"
          />
          <div v-else style="width: 105px; height: 155px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px;" :style="{ color: incomingColore }">◈</div>
          <div
            v-if="incomingWaifuSelId === w.id"
            :style="{
              position: 'absolute', top: '6px', right: '6px',
              background: incomingColore,
              borderRadius: '50%', width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', color: '#fff', zIndex: 5,
            }"
          >✓</div>
        </div>
      </div>

      <div v-if="incomingErrMsg" style="color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; text-align: center; margin-top: 8px;">{{ incomingErrMsg }}</div>

      <div class="flex gap-[10px] mt-5 justify-center">
        <button
          @click="incomingRifiuta"
          :disabled="incomingStato === 'loading'"
          style="background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3); border-radius: 8px; color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 9px 18px; cursor: pointer;"
        >{{ incomingStato === 'loading' ? '…' : 'RIFIUTA' }}</button>
        <button
          v-if="!incomingLimitRaggiunto"
          @click="incomingRispondi"
          :disabled="!incomingWaifuSelId || incomingStato === 'loading'"
          :style="{
            background: incomingWaifuSelId ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${incomingWaifuSelId ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '8px',
            color: incomingWaifuSelId ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
            fontFamily: '\'Orbitron\', sans-serif',
            fontSize: '9px',
            padding: '9px 22px',
            cursor: incomingWaifuSelId ? 'pointer' : 'not-allowed',
            letterSpacing: '1px',
          }"
        >{{ incomingStato === 'loading' ? '…' : 'PROPONI SCAMBIO' }}</button>
      </div>
    </div>
  </div>

  <!-- ======================================================
       MODAL: A ACCETTA LA PROPOSTA DI B (TradePendingConfirmModal)
       ====================================================== -->
  <div
    v-else-if="tradeAperto?.tipo === 'accept' || tradeAperto?.tipo === 'confirm'"
    class="fixed inset-0 z-[400] flex flex-col items-center justify-center overflow-y-auto px-4 py-6 gap-5"
    style="background: var(--theme-overlay); backdrop-filter: blur(20px);"
  >
    <div
      v-if="acceptStato === 'success'"
      class="flex flex-col items-center gap-3"
    >
      <div style="font-size: 40px;">✅</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: #00e676; letter-spacing: 2px;">{{ $t("trades.trade_accepted") }}</div>
      <div style="font-family: 'Fredoka', sans-serif; font-size: 12px; color: rgba(238,232,220,0.6);">
        {{ acceptTrade?.toName }} deve ora confermare per completare.
      </div>
    </div>
    <div
      v-else-if="acceptStato === 'cancelled'"
      class="flex flex-col items-center gap-3"
    >
      <div style="font-size: 40px;">❌</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: rgba(238,232,220,0.5); letter-spacing: 2px;">{{ $t("trades.trade_cancelled") }}</div>
    </div>
    <div v-else style="width: 100%; max-width: 440px;">
      <div class="flex items-center justify-between mb-4">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 3px; color: #42a5f5;">{{ $t("trades.accept_trade") }}</div>
        <button @click="tradeAperto = null" style="background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: rgba(238,232,220,0.5); font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 6px 12px; cursor: pointer;">✕</button>
      </div>

      <div style="font-family: 'Fredoka', sans-serif; font-size: 13px; color: rgba(238,232,220,0.7); margin-bottom: 18px; text-align: center;">
        <strong style="color: #ff4d9e;">{{ acceptTrade?.toName }}</strong> ha proposto questo scambio. Accetti?
      </div>

      <!-- Tu cedi ↔ Tu ricevi -->
      <div class="flex items-start justify-center gap-4 mb-5">
        <div class="text-center">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 8px; color: rgba(238,232,220,0.4); margin-bottom: 6px; letter-spacing: 1px;">{{ $t("trades.you_give") }}</div>
          <img
            v-if="acceptFromCatalog?.asset_statica || acceptFromCatalog?.immagine"
            :src="acceptFromCatalog.asset_statica || acceptFromCatalog.immagine"
            :alt="acceptFromCatalog.nome"
            style="width: 93px; height: 130px; object-fit: cover; border-radius: 8px;"
          />
          <div v-else style="width: 93px; height: 130px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;" :style="{ color: acceptColore }">◈</div>
        </div>
        <div style="font-size: 22px; color: #42a5f5; align-self: center; margin-top: 20px;">↔</div>
        <div class="text-center">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 8px; color: rgba(238,232,220,0.4); margin-bottom: 6px; letter-spacing: 1px;">{{ $t("trades.you_receive") }}</div>
          <img
            v-if="acceptToCatalog?.asset_statica || acceptToCatalog?.immagine"
            :src="acceptToCatalog.asset_statica || acceptToCatalog.immagine"
            :alt="acceptToCatalog.nome"
            style="width: 93px; height: 130px; object-fit: cover; border-radius: 8px;"
          />
          <div v-else style="width: 93px; height: 130px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;" :style="{ color: acceptColore }">◈</div>
        </div>
      </div>

      <div v-if="acceptErrMsg" style="color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; text-align: center; margin-bottom: 10px;">{{ acceptErrMsg }}</div>

      <div class="flex gap-[10px] justify-center">
        <button @click="acceptAnnulla" :disabled="acceptStato === 'loading'" style="background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3); border-radius: 8px; color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 9px 18px; cursor: pointer;">{{ $t("trades.reject") }}</button>
        <button @click="acceptAccetta" :disabled="acceptStato === 'loading'" style="background: rgba(66,165,245,0.15); border: 1px solid rgba(66,165,245,0.5); border-radius: 8px; color: #42a5f5; font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 9px 22px; cursor: pointer; letter-spacing: 1px;">{{ acceptStato === 'loading' ? '…' : '✓ ACCETTA' }}</button>
      </div>
    </div>
  </div>

  <!-- ======================================================
       MODAL: B CONFERMA E COMPLETA LO SCAMBIO (TradeBConfirmModal)
       ====================================================== -->
  <div
    v-else-if="tradeAperto?.tipo === 'confirm_b'"
    class="fixed inset-0 z-[400] flex flex-col items-center justify-center overflow-y-auto px-4 py-6 gap-5"
    style="background: var(--theme-overlay); backdrop-filter: blur(20px);"
  >
    <!-- Animazione ricezione waifu per B dopo conferma -->
    <div
      v-if="confirmStato === 'success' && confirmBReceivedByB"
      class="flex flex-col items-center gap-7"
    >
      <div style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 4px; color: #ff4d9e; opacity: 0.8;">{{ $t("trades.waifu_received") }}</div>
      <div>
        <img
          v-if="confirmFromImg"
          :src="confirmFromImg"
          :alt="confirmFromNome"
          style="width: 120px; height: 168px; object-fit: cover; border-radius: 8px;"
        />
        <div v-else style="width: 120px; height: 168px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 40px;" :style="{ color: confirmColore }">◈</div>
      </div>
      <div class="text-center">
        <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '11px', letterSpacing: '2px', marginBottom: '6px', color: confirmColore }">
          {{ confirmTrade?.rarita?.toUpperCase() }}
        </div>
        <div style="font-family: 'Fredoka', sans-serif; font-size: 19px; color: #eedcd4; margin-bottom: 4px;">{{ confirmFromNome }}</div>
        <button
          @click="onConfirmBAnimazioneCompleta"
          :style="{
            marginTop: '18px',
            background: `${confirmColore}20`,
            border: `1px solid ${confirmColore}60`,
            borderRadius: '22px',
            color: confirmColore,
            fontFamily: '\'Orbitron\', sans-serif',
            fontSize: '10px',
            padding: '11px 32px',
            cursor: 'pointer',
            letterSpacing: '2px',
          }"
        >{{ $t("trades.continue") }}</button>
      </div>
    </div>

    <div
      v-else-if="confirmStato === 'cancelled'"
      class="flex flex-col items-center gap-3"
    >
      <div style="font-size: 40px;">❌</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: rgba(238,232,220,0.5); letter-spacing: 2px;">{{ $t("trades.trade_cancelled") }}</div>
    </div>

    <div v-else style="width: 100%; max-width: 440px;">
      <div class="flex items-center justify-between mb-4">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 3px; color: #f5a623;">{{ $t("trades.confirm_trade") }}</div>
        <button @click="tradeAperto = null" style="background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: rgba(238,232,220,0.5); font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 6px 12px; cursor: pointer;">✕</button>
      </div>

      <div style="font-family: 'Fredoka', sans-serif; font-size: 13px; color: rgba(238,232,220,0.7); margin-bottom: 18px; text-align: center;">
        <strong style="color: #ff4d9e;">{{ confirmTrade?.fromName }}</strong> ha accettato la tua proposta. Conferma per completare lo scambio!
      </div>

      <!-- B cede ↔ B riceve -->
      <div class="flex items-start justify-center gap-4 mb-5">
        <div class="text-center">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 8px; color: rgba(238,232,220,0.4); margin-bottom: 6px; letter-spacing: 1px;">{{ $t("trades.you_give") }}</div>
          <img
            v-if="confirmToImg"
            :src="confirmToImg"
            :alt="confirmToNome"
            style="width: 93px; height: 130px; object-fit: cover; border-radius: 8px;"
          />
          <div v-else style="width: 93px; height: 130px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;" :style="{ color: confirmColore }">◈</div>
        </div>
        <div style="font-size: 22px; color: #f5a623; align-self: center; margin-top: 20px;">↔</div>
        <div class="text-center">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 8px; color: rgba(238,232,220,0.4); margin-bottom: 6px; letter-spacing: 1px;">{{ $t("trades.you_receive") }}</div>
          <img
            v-if="confirmFromImg"
            :src="confirmFromImg"
            :alt="confirmFromNome"
            style="width: 93px; height: 130px; object-fit: cover; border-radius: 8px;"
          />
          <div v-else style="width: 93px; height: 130px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;" :style="{ color: confirmColore }">◈</div>
        </div>
      </div>

      <div v-if="confirmErrMsg" style="color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; text-align: center; margin-bottom: 10px;">{{ confirmErrMsg }}</div>

      <div class="flex gap-[10px] justify-center">
        <button @click="confirmAnnulla" :disabled="confirmStato === 'loading'" style="background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3); border-radius: 8px; color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 9px 18px; cursor: pointer;">{{ $t("trades.cancel") }}</button>
        <button @click="confirmConferma" :disabled="confirmStato === 'loading'" style="background: rgba(245,166,35,0.15); border: 1px solid rgba(245,166,35,0.5); border-radius: 8px; color: #f5a623; font-family: 'Orbitron', sans-serif; font-size: 9px; padding: 9px 22px; cursor: pointer; letter-spacing: 1px;">{{ confirmStato === 'loading' ? '…' : '✓ COMPLETA SCAMBIO' }}</button>
      </div>
    </div>
  </div>

  <!-- ======================================================
       LISTA SCAMBI PRINCIPALE
       ====================================================== -->
  <div v-else>
    <!-- Stato caricamento -->
    <AppLoading v-if="loading" />

    <!-- Stato errore -->
    <div
      v-else-if="errore"
      class="text-center p-5"
      style="color: #ff4d4d; font-family: 'Orbitron', sans-serif; font-size: 10px;"
    >
      {{ errore }}
    </div>

    <!-- Nessuno scambio -->
    <div
      v-else-if="trades.length === 0"
      class="text-center rounded-xl px-4 py-8"
      style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);"
    >
      <div style="font-size: 32px; margin-bottom: 10px;">↔</div>
      <div style="font-family: 'Orbitron', sans-serif; font-size: 10px; color: rgba(238,232,220,0.4);">{{ $t("trades.no_trades") }}</div>
      <div style="font-family: 'Fredoka', sans-serif; font-size: 11px; color: rgba(238,232,220,0.3); margin-top: 4px;">{{ $t("trades.empty_hint") }}</div>
    </div>

    <!-- Lista scambi -->
    <div v-else class="flex flex-col gap-3">
      <!-- Counter scambi giornalieri + countdown -->
      <div
        class="flex items-center justify-between gap-2 rounded-[10px] px-[14px] py-2"
        style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);"
      >
        <div style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: rgba(238,232,220,0.4); letter-spacing: 1px;">{{ $t("trades.trades_today") }}</div>
        <div v-if="haTradePass" style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: #00e676;">✓ TRADE PASS — ILLIMITATI</div>
        <div v-else class="flex flex-col items-end gap-[3px]">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700;">
            <span :style="{ color: tradesToday >= DAILY_LIMIT ? '#ff4d4d' : '#eedcd4' }">{{ tradesToday }}</span>
            <span style="color: rgba(238,232,220,0.35);">/{{ DAILY_LIMIT }}</span>
            <span v-if="tradesToday < DAILY_LIMIT" style="color: #00e676; margin-left: 6px; font-size: 8px;">({{ DAILY_LIMIT - tradesToday }} rimasti)</span>
          </div>
          <span
            v-if="tradesResetAt && countdownRemaining"
            style="color: rgba(238,232,220,0.35); font-family: 'Orbitron', sans-serif; font-size: 7px;"
          >⏱ reset {{ countdownRemaining }}</span>
        </div>
      </div>

      <!-- Scambi attivi -->
      <div v-if="attivi.length > 0">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 9px; letter-spacing: 2px; color: rgba(238,232,220,0.4); margin-bottom: 8px;">
          SCAMBI IN CORSO ({{ attivi.length }})
        </div>
        <div class="flex flex-col gap-2">
          <!-- Riga singolo trade attivo -->
          <div
            v-for="t in attivi"
            :key="t.id"
            :style="{
              background: getStatusLabel(t, uid).action ? 'rgba(255,77,158,0.06)' : 'var(--surface)',
              border: `1px solid ${getStatusLabel(t, uid).action ? 'rgba(255,77,158,0.3)' : `${RARITA_COLORI[t.rarita] || '#f5a623'}20`}`,
              borderRadius: '12px',
              padding: '12px 14px',
              cursor: getStatusLabel(t, uid).action ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }"
            @click="getStatusLabel(t, uid).action && apriTrade(t)"
          >
            <div class="flex justify-between items-start mb-2">
              <div style="font-family: 'Fredoka', sans-serif; font-size: 12px; color: #eedcd4;">
                <template v-if="t.fromUid === uid">
                  Tu → <strong style="color: #ff4d9e;">{{ t.toName }}</strong>
                </template>
                <template v-else>
                  <strong style="color: #ff4d9e;">{{ t.fromName }}</strong> → Tu
                </template>
              </div>
              <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '9px', color: getStatusLabel(t, uid).color, letterSpacing: '1px' }">
                {{ getStatusLabel(t, uid).text }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <template v-if="waifuCat.find(w => w.id === t.fromWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.fromWaifuId)?.immagine">
                <img
                  :src="waifuCat.find(w => w.id === t.fromWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.fromWaifuId)?.immagine"
                  :alt="waifuCat.find(w => w.id === t.fromWaifuId)?.nome || t.fromWaifuId"
                  style="width: 36px; height: 50px; object-fit: cover; border-radius: 4px;"
                  :style="{ border: `1px solid ${RARITA_COLORI[t.rarita] || '#f5a623'}30` }"
                />
              </template>
              <div v-else style="width: 36px; height: 50px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;" :style="{ background: `${RARITA_COLORI[t.rarita] || '#f5a623'}10`, color: RARITA_COLORI[t.rarita] || '#f5a623' }">◈</div>
              <span style="color: rgba(238,232,220,0.4); font-size: 14px;">↔</span>
              <template v-if="t.toWaifuId">
                <template v-if="waifuCat.find(w => w.id === t.toWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.toWaifuId)?.immagine">
                  <img
                    :src="waifuCat.find(w => w.id === t.toWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.toWaifuId)?.immagine"
                    :alt="waifuCat.find(w => w.id === t.toWaifuId)?.nome || t.toWaifuId"
                    style="width: 36px; height: 50px; object-fit: cover; border-radius: 4px;"
                    :style="{ border: `1px solid ${RARITA_COLORI[t.rarita] || '#f5a623'}30` }"
                  />
                </template>
                <div v-else style="width: 36px; height: 50px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;" :style="{ background: `${RARITA_COLORI[t.rarita] || '#f5a623'}10`, color: RARITA_COLORI[t.rarita] || '#f5a623' }">◈</div>
              </template>
              <div v-else style="width: 36px; height: 50px; border-radius: 4px; border: 1px dashed rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 11px; color: rgba(238,232,220,0.25);">?</div>
              <div class="ml-1">
                <div style="font-family: 'Fredoka', sans-serif; font-size: 10px; color: #eedcd4;">{{ waifuCat.find(w => w.id === t.fromWaifuId)?.nome || t.fromWaifuId || '?' }}</div>
                <div v-if="t.toWaifuId" style="font-family: 'Fredoka', sans-serif; font-size: 10px; color: #eedcd4; margin-top: 2px;">{{ waifuCat.find(w => w.id === t.toWaifuId)?.nome || t.toWaifuId || '?' }}</div>
                <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '8px', color: RARITA_COLORI[t.rarita] || '#f5a623', marginTop: '2px' }">{{ t.rarita }}</div>
              </div>
              <div
                v-if="getStatusLabel(t, uid).action"
                class="ml-auto"
                style="background: rgba(255,77,158,0.15); border: 1px solid rgba(255,77,158,0.4); border-radius: 6px; font-family: 'Orbitron', sans-serif; font-size: 8px; color: #ff4d9e; padding: 4px 8px; letter-spacing: 1px;"
              >{{ $t("trades.action_required") }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scambi storici -->
      <div v-if="terminati.length > 0">
        <div
          style="font-family: 'Orbitron', sans-serif; font-size: 9px; letter-spacing: 2px; color: rgba(238,232,220,0.4); margin-bottom: 8px;"
          :style="{ marginTop: attivi.length > 0 ? '12px' : '0' }"
        >
          STORICI ({{ terminati.length }})
        </div>
        <div class="flex flex-col gap-2">
          <!-- Riga singolo trade storico -->
          <div
            v-for="t in terminatiPagina"
            :key="t.id"
            :style="{
              background: getStatusLabel(t, uid).action ? 'rgba(255,77,158,0.06)' : 'var(--surface)',
              border: `1px solid ${getStatusLabel(t, uid).action ? 'rgba(255,77,158,0.3)' : `${RARITA_COLORI[t.rarita] || '#f5a623'}20`}`,
              borderRadius: '12px',
              padding: '12px 14px',
              cursor: getStatusLabel(t, uid).action ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }"
            @click="getStatusLabel(t, uid).action && apriTrade(t)"
          >
            <div class="flex justify-between items-start mb-2">
              <div style="font-family: 'Fredoka', sans-serif; font-size: 12px; color: #eedcd4;">
                <template v-if="t.fromUid === uid">
                  Tu → <strong style="color: #ff4d9e;">{{ t.toName }}</strong>
                </template>
                <template v-else>
                  <strong style="color: #ff4d9e;">{{ t.fromName }}</strong> → Tu
                </template>
              </div>
              <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '9px', color: getStatusLabel(t, uid).color, letterSpacing: '1px' }">
                {{ getStatusLabel(t, uid).text }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <template v-if="waifuCat.find(w => w.id === t.fromWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.fromWaifuId)?.immagine">
                <img
                  :src="waifuCat.find(w => w.id === t.fromWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.fromWaifuId)?.immagine"
                  :alt="waifuCat.find(w => w.id === t.fromWaifuId)?.nome || t.fromWaifuId"
                  style="width: 36px; height: 50px; object-fit: cover; border-radius: 4px;"
                  :style="{ border: `1px solid ${RARITA_COLORI[t.rarita] || '#f5a623'}30` }"
                />
              </template>
              <div v-else style="width: 36px; height: 50px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;" :style="{ background: `${RARITA_COLORI[t.rarita] || '#f5a623'}10`, color: RARITA_COLORI[t.rarita] || '#f5a623' }">◈</div>
              <span style="color: rgba(238,232,220,0.4); font-size: 14px;">↔</span>
              <template v-if="t.toWaifuId">
                <template v-if="waifuCat.find(w => w.id === t.toWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.toWaifuId)?.immagine">
                  <img
                    :src="waifuCat.find(w => w.id === t.toWaifuId)?.asset_statica || waifuCat.find(w => w.id === t.toWaifuId)?.immagine"
                    :alt="waifuCat.find(w => w.id === t.toWaifuId)?.nome || t.toWaifuId"
                    style="width: 36px; height: 50px; object-fit: cover; border-radius: 4px;"
                    :style="{ border: `1px solid ${RARITA_COLORI[t.rarita] || '#f5a623'}30` }"
                  />
                </template>
                <div v-else style="width: 36px; height: 50px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;" :style="{ background: `${RARITA_COLORI[t.rarita] || '#f5a623'}10`, color: RARITA_COLORI[t.rarita] || '#f5a623' }">◈</div>
              </template>
              <div v-else style="width: 36px; height: 50px; border-radius: 4px; border: 1px dashed rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 11px; color: rgba(238,232,220,0.25);">?</div>
              <div class="ml-1">
                <div style="font-family: 'Fredoka', sans-serif; font-size: 10px; color: #eedcd4;">{{ waifuCat.find(w => w.id === t.fromWaifuId)?.nome || t.fromWaifuId || '?' }}</div>
                <div v-if="t.toWaifuId" style="font-family: 'Fredoka', sans-serif; font-size: 10px; color: #eedcd4; margin-top: 2px;">{{ waifuCat.find(w => w.id === t.toWaifuId)?.nome || t.toWaifuId || '?' }}</div>
                <div :style="{ fontFamily: '\'Orbitron\', sans-serif', fontSize: '8px', color: RARITA_COLORI[t.rarita] || '#f5a623', marginTop: '2px' }">{{ t.rarita }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Paginazione -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-[10px] mt-3">
          <button
            @click="page = Math.max(0, page - 1)"
            :disabled="page === 0"
            :style="{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '7px',
              color: page === 0 ? 'rgba(255,255,255,0.2)' : '#eedcd4',
              fontFamily: '\'Orbitron\', sans-serif',
              fontSize: '9px',
              padding: '5px 12px',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }"
          >← Prec</button>
          <span style="font-family: 'Orbitron', sans-serif; font-size: 9px; color: rgba(238,232,220,0.5);">{{ page + 1 }}/{{ totalPages }}</span>
          <button
            @click="page = Math.min(totalPages - 1, page + 1)"
            :disabled="page >= totalPages - 1"
            :style="{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '7px',
              color: page >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : '#eedcd4',
              fontFamily: '\'Orbitron\', sans-serif',
              fontSize: '9px',
              padding: '5px 12px',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
            }"
          >Succ →</button>
        </div>
      </div>
    </div>
  </div>
</template>

