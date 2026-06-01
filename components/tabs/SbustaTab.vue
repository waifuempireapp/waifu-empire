<!-- ============================================================
  Tab Sbusta: apertura pacchetti gacha (omaggio, benvenuto, sfida).
  Gestisce la rivelazione animata delle carte, i drop stagionali,
  i God Pack e l'acquisto bustine con Kisses.
  Equivalente di src/app/gioco/_redesign/Sbusta.jsx
  ============================================================ -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, useTemplateRef } from 'vue'
import type { ProfiloUtente, Collezione, WaifuCatalog, MossaCatalog } from '~/types/game'
import {
  listDropsAttivi,
  updateUserProfile,
  setCollezione as saveCollezione,
  createPackSnapshot,
  isDropCompleto,
  progressioneDrop,
} from '~/utils/firestoreService'
import { generaPacchetto, GOD_PACK_PROB_DEFAULT } from '~/utils/gameLogic'
import { TIMER, RARITA } from '~/utils/constants'
import { useAuthStore } from '~/stores/auth'
import { ikUrl } from '~/utils/imagekitUrl'

// ── Costanti colori e font ───────────────────────────────────
const C = {
  gold: '#f5c560',
  goldL: '#ffe9a8',
  sakura: '#ff85b6',
  sakuraL: '#ffc3da',
  aqua: '#6cf0e0',
  violet: '#a78bfa',
  ok: '#58e0a3',
  err: '#ff5b6c',
  inkLine: 'rgba(174,156,255,0.12)',
}
const FF = {
  display: "var(--ff-display,'Unbounded',sans-serif)",
  label: "var(--ff-label,'Saira Condensed',sans-serif)",
  body: "var(--ff-body,'DM Sans',sans-serif)",
  mono: "var(--ff-mono,'JetBrains Mono',monospace)",
}

// ── Props ────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  profilo: ProfiloUtente | null
  collezione: Collezione | null
  waifuCat: WaifuCatalog[]
  mosseCat: MossaCatalog[]
  godPackProb?: number
}>(), {
  godPackProb: GOD_PACK_PROB_DEFAULT,
})

// ── Emits ────────────────────────────────────────────────────
const emit = defineEmits<{
  notif: [testo: string, colore: string]
  updateProfilo: [p: unknown]
  updateCollezione: [c: unknown]
  setTab: [tab: string]
}>()

const authStore = useAuthStore()

// ── Stato principale ─────────────────────────────────────────
const stato = ref<'idle' | 'reveal' | 'reveal_multi' | 'summary' | 'summary_multi'>('idle')
const carteRivelate = ref<any[]>([])
const indiceRivelato = ref(-1)
const dropsAttivi = ref<any[]>([])
const dropsLoading = ref(true)
const dropSelId = ref<string | null>(null)
const isGodPackAperto = ref(false)
const popupApertura = ref<{ tipoPacchetto: string } | null>(null)
const sfidaConferma = ref(false)
const sfidaShortage = ref(false)
const multiPackCarte = ref<any[][]>([])
const multiPackIndice = ref(0)

// Nuovi stati per l'animazione di apertura pacchetto in stile Pokémon Pocket
const bustaAperta = ref(false)
const bustaInAnimazione = ref(false)
const transizioneCarta = ref(false)
const YInizioSwipe = ref(0)

// Stato video carta immersiva
const sbusVideoAttivo = ref(false)
const sbusVideoFinito = ref(false)
const sbusCartaImmersiva = ref<any>(null)
const sbusVideoRef = useTemplateRef<HTMLVideoElement>('sbusVideoRef')

// Carica drop attivi all'avvio
onMounted(async () => {
  dropsLoading.value = true
  try {
    const lista = await listDropsAttivi()
    dropsAttivi.value = lista
    if (lista.length > 0) dropSelId.value = lista[0].id
  } catch {
    // ignora
  } finally {
    dropsLoading.value = false
  }
})

// ── Drop computati ───────────────────────────────────────────
const dropAttivo = computed(() =>
  dropsAttivi.value.find((d: any) => d.id === dropSelId.value) || dropsAttivi.value[0] || null
)

const dropWaifu = computed(() =>
  dropAttivo.value?.waifuIds
    ? props.waifuCat.filter((w: any) => dropAttivo.value.waifuIds.includes(w.id))
    : props.waifuCat
)

const dropColore = computed(() => dropAttivo.value?.colore || C.violet)
const dropColore2 = computed(() => dropAttivo.value?.colore2 || C.sakura)

const SFIDA_COSTO_KISSES = 50
const SFIDA_COSTO_10 = 450

const nBenv = computed(() => props.profilo?.pacchettiBenvenuto ?? 0)
const nOmag = computed(() => props.profilo?.pacchettiOmaggio ?? 0)
const nSfid = computed(() => props.profilo?.pacchettiSfida ?? 0)

const progDrop = computed(() => progressioneDrop(dropAttivo.value as any, props.collezione as any))
const dropCompleto = computed(() => isDropCompleto(dropAttivo.value as any, props.collezione as any))

// ── Generazione e aggiornamento pacchetto ────────────────────
async function _generaEAggiorna(tipoPacchetto: string, nuovaCollezione: any) {
  const drop = dropAttivo.value
  const hasHardPass = props.profilo?.hardPass === true
  const filteredWaifuCat = hasHardPass ? props.waifuCat : props.waifuCat.filter((w: any) => !w.hot)
  const wp = drop?.waifuIds ? filteredWaifuCat.filter((w: any) => drop.waifuIds.includes(w.id)) : filteredWaifuCat
  const mp = props.mosseCat
  if (wp.length === 0) {
    emit('notif', 'Nessuna waifu nel drop attivo.', C.err)
    return null
  }
  const escludiDoppioni = tipoPacchetto === 'benvenuto'
  const waifuPossedute = escludiDoppioni ? Object.keys(nuovaCollezione.waifu || {}) : []
  const carte = generaPacchetto({
    waifuPool: wp as any,
    mossePool: mp as any,
    escludiDoppioniWaifu: escludiDoppioni,
    waifuPossedute,
    godPackProb: props.godPackProb,
  })

  carte.forEach((c: any) => {
    if (c.tipo === 'waifu') {
      c.isNuova = !nuovaCollezione.waifu[c.data.id]
      if (nuovaCollezione.waifu[c.data.id]) nuovaCollezione.waifu[c.data.id].copie++
      else nuovaCollezione.waifu[c.data.id] = { copie: 1, livello: 1, stat_bonus: {} }
    } else if (c.tipo === 'mossa') {
      c.isNuova = !(nuovaCollezione.mosse?.[c.data.id]?.copie > 0)
      if (!nuovaCollezione.mosse) nuovaCollezione.mosse = {}
      if (nuovaCollezione.mosse[c.data.id]) nuovaCollezione.mosse[c.data.id].copie++
      else nuovaCollezione.mosse[c.data.id] = { copie: 1, livello: 1 }
    }
  })
  return carte
}

function avviaRivelazione(_carte: any[]) {
  setTimeout(() => { indiceRivelato.value = 0 }, 500)
}

// Avanza alla carta successiva con animazione di sfilamento (Swipe/Click)
function avanzaCartaManuale() {
  if (transizioneCarta.value) return
  transizioneCarta.value = true

  setTimeout(() => {
    const next = indiceRivelato.value + 1
    if (next < carteRivelate.value.length) {
      indiceRivelato.value = next
      revealTilt.value = { x: 0, y: 0 }
    }
    transizioneCarta.value = false
  }, 350) // Tempo coerente con l'animazione CSS d'uscita
}

// Gestione dello swipe della bustina (Dall'alto verso il basso per tagliare la linea)
function onBustaTouchStart(e: TouchEvent) {
  YInizioSwipe.value = e.touches[0].clientY
}

function onBustaTouchMove(e: TouchEvent) {
  if (bustaAperta.value || bustaInAnimazione.value) return
  const currentY = e.touches[0].clientY
  if (currentY - YInizioSwipe.value > 60) {
    eseguiTaglioBustina()
  }
}

function eseguiTaglioBustina() {
  bustaInAnimazione.value = true
  setTimeout(() => {
    bustaAperta.value = true
    bustaInAnimazione.value = false
    avviaRivelazione(carteRivelate.value)
  }, 800)
}

// Apri singolo pacchetto
async function apri(tipoPacchetto: string) {
  const uid = authStore.user?.uid
  if (!uid || !props.collezione) return
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  const carte = await _generaEAggiorna(tipoPacchetto, nuova)
  if (!carte) return

  const gp = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value = carte
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  stato.value = 'reveal'

  emit('updateCollezione', nuova)
  try {
    await saveCollezione(uid, nuova as any)
    if (tipoPacchetto === 'benvenuto') {
      const n = (props.profilo?.pacchettiBenvenuto ?? 0) - 1
      emit('updateProfilo', { pacchettiBenvenuto: n })
      await updateUserProfile(uid, { pacchettiBenvenuto: n })
    } else if (tipoPacchetto === 'omaggio') {
      const n = (props.profilo?.pacchettiOmaggio ?? 0) - 1
      emit('updateProfilo', { pacchettiOmaggio: n })
      await updateUserProfile(uid, { pacchettiOmaggio: n })
    } else {
      const n = (props.profilo?.pacchettiSfida ?? 0) - 1
      emit('updateProfilo', { pacchettiSfida: n })
      await updateUserProfile(uid, { pacchettiSfida: n })
    }
  } catch (e) {
    console.error('apri: errore salvataggio', e)
  }

  const carteClean = JSON.parse(JSON.stringify(carte))
  createPackSnapshot(uid, carteClean, {
    dropId: dropAttivo.value?.id || null,
    dropName: dropAttivo.value?.nome || null,
  }).catch((e: any) => console.error('createPackSnapshot:', e))
}

// Apri fino a 10 pacchetti in sequenza
async function apriMulti(tipoPacchetto: string) {
  const uid = authStore.user?.uid
  if (!uid || !props.collezione) return
  const disponibili = tipoPacchetto === 'benvenuto'
    ? (props.profilo?.pacchettiBenvenuto ?? 0)
    : tipoPacchetto === 'omaggio'
      ? (props.profilo?.pacchettiOmaggio ?? 0)
      : (props.profilo?.pacchettiSfida ?? 0)
  const quanti = Math.min(10, disponibili)
  if (quanti < 1) { emit('notif', 'Nessun pacchetto disponibile.', C.err); return }

  const nuova = JSON.parse(JSON.stringify(props.collezione))
  const tuttiIPacchetti: any[][] = []
  for (let i = 0; i < quanti; i++) {
    const carte = await _generaEAggiorna(tipoPacchetto, nuova)
    if (!carte) break
    tuttiIPacchetti.push(carte)
  }
  if (tuttiIPacchetti.length === 0) return

  multiPackCarte.value = tuttiIPacchetti
  multiPackIndice.value = 0
  const prime = tuttiIPacchetti[0]
  const gp = prime.length === 5 && prime.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value = prime
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  stato.value = 'reveal_multi'

  emit('updateCollezione', nuova)
  try {
    await saveCollezione(uid, nuova as any)
    if (tipoPacchetto === 'benvenuto') {
      const n = (props.profilo?.pacchettiBenvenuto ?? 0) - tuttiIPacchetti.length
      emit('updateProfilo', { pacchettiBenvenuto: n })
      await updateUserProfile(uid, { pacchettiBenvenuto: n })
    } else if (tipoPacchetto === 'omaggio') {
      const n = (props.profilo?.pacchettiOmaggio ?? 0) - tuttiIPacchetti.length
      emit('updateProfilo', { pacchettiOmaggio: n })
      await updateUserProfile(uid, { pacchettiOmaggio: n })
    } else {
      const n = (props.profilo?.pacchettiSfida ?? 0) - tuttiIPacchetti.length
      emit('updateProfilo', { pacchettiSfida: n })
      await updateUserProfile(uid, { pacchettiSfida: n })
    }
  } catch (e) {
    console.error('apriMulti: errore salvataggio', e)
  }

  tuttiIPacchetti.forEach(carte => {
    const carteClean = JSON.parse(JSON.stringify(carte))
    createPackSnapshot(uid, carteClean).catch((e: any) => console.error('createPackSnapshot:', e))
  })
}

function prossimoPackMulti() {
  const prossimo = multiPackIndice.value + 1
  const carte = multiPackCarte.value[prossimo]
  const gp = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value = carte
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  multiPackIndice.value = prossimo
}

function tornaIdle() {
  stato.value = 'idle'
  carteRivelate.value = []
  multiPackCarte.value = []
  multiPackIndice.value = 0
  bustaAperta.value = false
}

function mostraRiepilogo() {
  if (stato.value === 'reveal_multi' && multiPackIndice.value < multiPackCarte.value.length - 1) {
    prossimoPackMulti()
  } else if (stato.value === 'reveal_multi') {
    stato.value = 'summary_multi'
  } else {
    stato.value = 'summary'
  }
}

const copieCartaCorrente = computed(() => {
  if (!cartaCorrente.value || cartaCorrente.value.tipo !== 'waifu') return 0
  return (props.collezione?.waifu as any)?.[cartaCorrente.value.data?.id]?.copie ?? 0
})
const levelUpDisponibile = computed(() => copieCartaCorrente.value >= 3)

const contaPackPopup = computed((): number => {
  const t = popupApertura.value?.tipoPacchetto
  if (t === 'benvenuto') return Number(nBenv.value)
  if (t === 'omaggio') return Number(nOmag.value)
  return Number(nSfid.value)
})

function getCopie(carta: any): number {
  if (!carta || carta.tipo !== 'waifu') return 0
  return (props.collezione?.waifu as any)?.[carta.data?.id]?.copie ?? 0
}

function avviaVideoSbusto(carta: any) {
  sbusCartaImmersiva.value = carta
  sbusVideoFinito.value = false
  sbusVideoAttivo.value = true
  nextTick(() => sbusVideoRef.value?.play())
}
function rivediVideoSbusto() {
  sbusVideoFinito.value = false
  if (sbusVideoRef.value) {
    sbusVideoRef.value.currentTime = 0
    sbusVideoRef.value.play()
  }
}
function chiudiVideoSbusto() {
  sbusVideoAttivo.value = false
  sbusVideoFinito.value = false
  sbusCartaImmersiva.value = null
}

async function acquistaSfidaConKisses(qty = 1) {
  sfidaConferma.value = false
  const token = await authStore.user?.getIdToken()
  const endpoint = qty === 10 ? '/api/kisses/buy-pack-10' : '/api/kisses/buy-pack'
  try {
    const data = await $fetch<any>(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const spent = data.kissesCost ?? (qty === 10 ? SFIDA_COSTO_10 : SFIDA_COSTO_KISSES)
    const newKisses = Math.max(0, (props.profilo?.kisses ?? 0) - spent)
    const pAgg = data.pacchettiAggiunti ?? qty
    const newSfid = (props.profilo?.pacchettiSfida ?? 0) + pAgg
    emit('updateProfilo', { kisses: newKisses, pacchettiSfida: newSfid })
    if (qty === 1) popupApertura.value = { tipoPacchetto: 'sfida' }
    else emit('notif', `+${pAgg} bustine sfida aggiunte!`, '#ff8c00')
  } catch (e: any) {
    emit('notif', e?.data?.error || 'Errore acquisto', C.err)
  }
}

const countdown = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null

function aggiornaCountdown() {
  const ur = (props.profilo as any)?.ultimaRicaricaPacchetti
  const lastTs = ur?.toMillis ? ur.toMillis()
    : ur?.seconds ? ur.seconds * 1000
      : Number(ur) || 0
  const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000
  const diff = prossima - Date.now()
  if (diff <= 0) { countdown.value = 'Pronto!'; return }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  countdown.value = `${h}h ${m}m ${s}s`
}

onMounted(() => {
  aggiornaCountdown()
  countdownInterval = setInterval(aggiornaCountdown, 1000)
})
onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})
watch(() => (props.profilo as any)?.ultimaRicaricaPacchetti, aggiornaCountdown)

// ── 3D tilt carta rivelata ───────────────────────────────────
const revealTilt = ref({ x: 0, y: 0 })
const revealDragging = ref(false)
const revealDragOrigin = ref({ x: 0, y: 0, tx: 0, ty: 0 })

const cartaCorrente = computed(() =>
  indiceRivelato.value >= 0 ? carteRivelate.value[indiceRivelato.value] : null
)

// Ritorna ESATTAMENTE le carte rimanenti dietro per calcolare lo spessore reale del mazzo
const carteNelMazzo = computed(() =>
  indiceRivelato.value >= 0 ? carteRivelate.value.slice(indiceRivelato.value + 1) : []
)

const RARITY_COLORS: Record<string, string> = {
  comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
  leggendario: '#ffc861', immersivo: '#ff7eb6',
}
function raritaGlow(carta: any): string {
  return RARITY_COLORS[carta?.data?.rarita] || '#a78bfa'
}

function onRevealMouseMove(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  revealTilt.value = { x: -(y - 0.5) * 24, y: (x - 0.5) * 28 }
}
function onRevealMouseLeave() {
  revealTilt.value = { x: 0, y: 0 }
}
function onRevealTouchStart(e: TouchEvent) {
  revealDragging.value = true
  revealDragOrigin.value = {
    x: e.touches[0].clientX, y: e.touches[0].clientY,
    tx: revealTilt.value.x, ty: revealTilt.value.y,
  }
}
function onRevealTouchMove(e: TouchEvent) {
  if (!revealDragging.value) return
  const dx = e.touches[0].clientX - revealDragOrigin.value.x
  const dy = e.touches[0].clientY - revealDragOrigin.value.y
  revealTilt.value = {
    x: Math.max(-30, Math.min(30, revealDragOrigin.value.tx - dy * 0.3)),
    y: Math.max(-30, Math.min(30, revealDragOrigin.value.ty + dx * 0.3)),
  }
}
function onRevealTouchEnd() {
  revealDragging.value = false
  revealTilt.value = { x: 0, y: 0 }
}

const packTilts = ref<Record<string, string>>({})
const packSheens = ref<Record<string, string>>({})
const hoveredPack = ref<string | null>(null)

function onPackHover(e: MouseEvent, id: string) {
  hoveredPack.value = id
  const el = (e.currentTarget as HTMLElement).querySelector('.pack-body') as HTMLElement
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const rotY = (x - 0.5) * 22
  const rotX = -(y - 0.5) * 16
  packTilts.value = { ...packTilts.value, [id]: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.04)` }
  packSheens.value = { ...packSheens.value, [id]: `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)` }
}

function onPackLeave(id: string) {
  hoveredPack.value = null
  packTilts.value = { ...packTilts.value, [id]: 'rotateX(0deg) rotateY(0deg) scale(1)' }
  packSheens.value = { ...packSheens.value, [id]: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)' }
}

const selectedDropIndex = computed(() =>
  Math.max(0, dropsAttivi.value.findIndex(d => d.id === dropSelId.value))
)

function getCoverflowStyle(index: number): Record<string, string | number> {
  const dist = index - selectedDropIndex.value
  const STEP = 88
  let rotY: number, scale: number, zOff: number, opacity: number

  if (dist === 0) {
    rotY = 0; scale = 1.12; zOff = 50; opacity = 1
  } else if (Math.abs(dist) === 1) {
    rotY = dist < 0 ? 42 : -42; scale = 0.82; zOff = -18; opacity = 0.88
  } else if (Math.abs(dist) === 2) {
    rotY = dist < 0 ? 58 : -58; scale = 0.66; zOff = -56; opacity = 0.65
  } else {
    rotY = dist < 0 ? 68 : -68; scale = 0.54; zOff = -90; opacity = 0.38
  }

  const xOffset = dist * STEP
  return {
    transform: `translate(-50%, -50%) translateX(${xOffset}px) translateZ(${zOff}px) rotateY(${rotY}deg) scale(${scale})`,
    zIndex: String(20 - Math.abs(dist)),
    opacity: String(opacity),
  }
}

const cfTouchStartX = ref(0)
function cfTouchStart(e: TouchEvent) { cfTouchStartX.value = e.touches[0].clientX }
function cfTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - cfTouchStartX.value
  if (Math.abs(dx) < 38) return
  const idx = selectedDropIndex.value
  if (dx < 0 && idx < dropsAttivi.value.length - 1) dropSelId.value = dropsAttivi.value[idx + 1].id
  else if (dx > 0 && idx > 0) dropSelId.value = dropsAttivi.value[idx - 1].id
}
</script>

<template>
  <!-- SKELETON LOADING INIZIALE -->
  <div v-if="dropsLoading" class="fade-in" :style="{ padding: '10px 0', position: 'relative' }">
    <div :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }">
      <span v-for="i in 4" :key="i"
        :style="{ position: 'absolute', fontSize: '18px', opacity: 0.15, top: `${10 + i * 22}%`, left: `${5 + i * 23}%`, animation: 'float 4s ease-in-out infinite', animationDelay: `${i * 0.6}s` }">🌸</span>
    </div>
    <div :style="{ position: 'relative', zIndex: 1, padding: '0 8px' }">
      <div
        :style="{ height: '60px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', marginBottom: '20px', animation: 'pulse 1.2s ease-in-out infinite' }" />
      <div :style="{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }">
        <div v-for="i in 3" :key="i"
          :style="{ width: '100px', height: '140px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: `pulse 1.2s ease-in-out ${(i - 1) * 0.15}s infinite` }" />
      </div>
      <div
        :style="{ textAlign: 'center', fontFamily: 'DM Sans,sans-serif', fontSize: '12px', color: 'rgba(241,235,255,0.3)' }">
        Caricamento drop stagionale…</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    REVEAL VIEW — Pokémon Pocket Style Pack Opening & 3D Stack
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'reveal' || stato === 'reveal_multi'"
    style="position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, #090514 0%, #110724 50%, #05030a 100%); perspective: 1200px;">

    <!-- 1. FASE DI SBUSTO INTERATTIVA (Prima di mostrare le carte) -->
    <div v-if="!bustaAperta"
      style="position: absolute; inset: 0; z-index: 250; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, #180d36 0%, #06030d 100%); cursor: pointer;"
      @click="eseguiTaglioBustina">
      <div style="text-align: center; margin-bottom: 40px; padding: 0 30px; animation: pulseSoft 2s infinite;">
        <p :style="{ fontFamily: FF.label, fontSize: '13px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '3px' }">
          ▶ Tocca per aprire
        </p>
      </div>

      <!-- Corpo del Pacchetto Olografico -->
      <div :class="['booster-pack-wrapper', { 'rip-animation': bustaInAnimazione }]"
        style="position: relative; width: 220px; height: 360px; border-radius: 8px; box-shadow: 0 30px 70px rgba(0,0,0,0.8); overflow: hidden; transition: transform 0.5s;">
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #185a9d 0%, #0c2540 100%);">
          <img v-if="dropAttivo?.asset_bustina" :src="dropAttivo.asset_bustina"
            style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <!-- Linea Neon di Taglio Gimmick Pokémon Pocket -->
        <div class="glow-line"
          style="position: absolute; top: 75px; left: 0; right: 0; height: 3px; background: #00ffff; box-shadow: 0 0 15px #00ffff, 0 0 30px #00ffff; z-index: 10;" />
      </div>
    </div>

    <!-- 2. STACK DI CARTE REALI DIETRO + INTERAZIONE INTERFACCIA -->
    <template v-else>
      <div
        :style="{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${raritaGlow(cartaCorrente)}26 0%, transparent 65%)`, transition: 'background 0.5s ease' }" />

      <!-- Top Header Progress -->
      <div style="position: relative; z-index: 10; padding: 20px 20px 0; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px;">
          <div v-for="(c, i) in carteRivelate" :key="i" :style="{
            width: i <= indiceRivelato ? '28px' : '8px',
            height: '6px',
            borderRadius: '999px',
            background: i < indiceRivelato ? 'rgba(255,255,255,0.4)' : i === indiceRivelato ? raritaGlow(cartaCorrente) : 'rgba(255,255,255,0.15)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: i === indiceRivelato ? `0 0 12px ${raritaGlow(cartaCorrente)}` : 'none',
          }" />
        </div>
        <div
          :style="{ fontFamily: FF.label, fontSize: '13px', color: '#f5c560', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }">
          <template v-if="stato === 'reveal_multi'">Pacchetto {{ multiPackIndice + 1 }}/{{ multiPackCarte.length }} ·
          </template>
          Carta {{ Math.max(1, indiceRivelato + 1) }} di {{ carteRivelate.length }}
        </div>
      </div>

      <!-- Area Centrale di Gioco delle Carte -->
      <div
        style="position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; z-index: 5; transform-style: preserve-3d;"
        @click="indiceRivelato < carteRivelate.length - 1 ? avanzaCartaManuale() : mostraRiepilogo()">

        <!-- Stack carte rimanenti — centrate, con rarità e tilt sincronizzato -->
        <div v-for="(c, i) in carteNelMazzo" :key="'back-' + i" :style="{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '220px', height: '330px',
          borderRadius: '16px',
          transform: `translate(-50%, -50%) rotateX(${revealTilt.x * 0.55}deg) rotateY(${revealTilt.y * 0.55}deg) translateZ(${-(i + 1) * 10}px) translateY(${(i + 1) * 3}px) scale(${1 - (i + 1) * 0.018})`,
          zIndex: 50 - i,
          background: `radial-gradient(130% 80% at 50% 20%, ${raritaGlow(c)}28 0%, transparent 50%), linear-gradient(160deg, #1c0e3a 0%, #060414 100%)`,
          border: `1.5px solid ${raritaGlow(c)}55`,
          boxShadow: `0 6px 20px rgba(0,0,0,0.6), 0 0 14px ${raritaGlow(c)}28`,
          transition: revealDragging ? 'none' : 'transform 0.22s ease-out',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }">
          <div style="position:absolute;inset:0;background-image:repeating-radial-gradient(circle at 50% 50%,transparent 0,transparent 12px,rgba(255,255,255,0.015) 12px,rgba(255,255,255,0.015) 13px);pointer-events:none;" />
          <div :style="{ fontSize: '48px', opacity: 0.15, filter: `drop-shadow(0 0 12px ${raritaGlow(c)})`, color: raritaGlow(c) }">♛</div>
          <div :style="{
            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
            padding: '2px 8px', borderRadius: '999px',
            background: `${raritaGlow(c)}22`, border: `1px solid ${raritaGlow(c)}55`,
            fontFamily: FF.label, fontSize: '7px', fontWeight: 700,
            color: raritaGlow(c), letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }">{{ c?.data?.rarita || '?' }}</div>
        </div>

        <!-- CARTA PRINCIPALE INTERATTIVA IN PRIMO PIANO -->
        <div v-if="cartaCorrente && indiceRivelato >= 0"
          :class="['main-reveal-card-container', { 'slide-out-animation': transizioneCarta }]"
          style="position: relative; z-index: 100; perspective: 1000px;" @mousemove="onRevealMouseMove"
          @mouseleave="onRevealMouseLeave" @touchstart.passive="onRevealTouchStart"
          @touchmove.passive="onRevealTouchMove" @touchend.passive="onRevealTouchEnd">
          <!-- Badge Nuova/Copie -->
          <div v-if="cartaCorrente.isNuova"
            style="position:absolute; top:-25px; left:-15px; z-index:130; background:linear-gradient(135deg,#00b4ff,#00e676); border:2px solid #fff; border-radius:999px; padding:4px 14px; font-family:var(--ff-label); font-size:14px; font-weight:900; color:#000; boxShadow:0 4px 12px rgba(0,180,255,0.5);">
            NEW</div>
          <div v-else-if="cartaCorrente.tipo === 'waifu'"
            style="position:absolute; top:-20px; right:-15px; z-index:130; background:linear-gradient(135deg,#1a0a35,#2a1255); border:2px solid #f5c560; border-radius:999px; min-width:32px; height:32px; display:flex; alignItems:center; justifyContent:center; font-family:var(--ff-mono); font-size:14px; font-weight:900; color:#fff;">
            {{ copieCartaCorrente }}</div>

          <!-- Aura Glow Energetica -->
          <div
            :style="{ position: 'absolute', inset: '-15px', borderRadius: '25px', background: `radial-gradient(circle, ${raritaGlow(cartaCorrente)}3b 0%, transparent 70%)`, pointerEvents: 'none' }" />

          <!-- Render Fisico Carta Dinamica -->
          <div :style="{
            transform: `rotateX(${revealTilt.x}deg) rotateY(${revealTilt.y}deg) scale(1.02)`,
            transformStyle: 'preserve-3d',
            transition: revealDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'transform',
          }">
            <CartaWaifu v-if="cartaCorrente.tipo === 'waifu'" :waifu="cartaCorrente.data" dimensione="normale"
              tipo="auto" />
            <CartaMossa v-else-if="cartaCorrente.tipo === 'mossa'" :mossa="cartaCorrente.data" dimensione="normale" />
          </div>
        </div>

        <!-- Feedback UI in basso -->
        <div v-if="levelUpDisponibile && indiceRivelato >= 0"
          style="margin-top:20px; padding:6px 16px; border-radius:999px; background:rgba(0,200,83,0.12); border:1px solid #58e0a3; font-family:var(--ff-label); font-size:12px; color:#58e0a3; text-transform:uppercase; letter-spacing:1px;">
          ⚡ Aumento di livello disponibile
        </div>

        <div v-if="indiceRivelato >= carteRivelate.length - 1"
          style="margin-top:25px; font-family:var(--ff-label); font-size:12px; letter-spacing:2px; color:rgba(255,255,255,0.4); text-transform:uppercase; animation:pulseSoft 1.6s infinite;">
          Tocca per il riepilogo →
        </div>
      </div>
    </template>

    <!-- Overlay Video Immersivo Sezione Sblocchi -->
    <div v-if="sbusVideoAttivo && sbusCartaImmersiva" @click="sbusVideoFinito ? chiudiVideoSbusto() : undefined"
      style="position: fixed; inset: 0; background: rgba(4,2,10,0.97); backdrop-filter: blur(20px); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div @click.stop style="animation: scaleIn 0.25s ease-out">
        <CartaWaifu :waifu="sbusCartaImmersiva" dimensione="grande" tipo="auto" :video-attivo="sbusVideoAttivo"
          @video-end="sbusVideoFinito = true" />
        <video ref="sbusVideoRef" :src="sbusCartaImmersiva?.asset_video" style="display: none"
          @ended="sbusVideoFinito = true" />
      </div>
      <div v-if="sbusVideoFinito" @click.stop style="margin-top: 20px; display: flex; gap: 12px;">
        <BtnDecorato variant="secondary" size="md" @click="rivediVideoSbusto">↺ Rivedi</BtnDecorato>
        <BtnDecorato variant="danger" size="md" @click="chiudiVideoSbusto">✕ Chiudi</BtnDecorato>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    SUMMARY SINGLE PACK (Griglia delle 5 Carte Ottenute)
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'summary'" class="fade-in"
    style="position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%);">
    <div
      :style="{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(ellipse 80% 50% at 50% 30%,${C.violet}18 0%,transparent 65%)` }" />
    <div style="flex-shrink:0;padding:24px 20px 12px;text-align:center;position:relative;z-index:10;">
      <div
        :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.3em', color: `rgba(245,197,96,0.7)`, textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }">
        CARTE OTTENUTE</div>
      <div :style="{ fontFamily: FF.display, fontSize: '20px', fontWeight: 900, color: '#eedcd4', letterSpacing: '2px' }">
        Pack
        Aperto!</div>
    </div>
    <div
      style="flex:1;overflow-y:auto;padding:12px 16px 8px;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;position:relative;z-index:5;">
      <div style="display:flex;gap:12px;justify-content:center;">
        <div v-for="(carta, ci) in carteRivelate.slice(0, 2)" :key="'s0-' + ci"
          style="width:110px;position:relative;flex-shrink:0;">
          <div v-if="carta.isNuova"
            style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label);font-size:10px;font-weight:900;color:#000;box-shadow:0 3px 10px rgba(0,180,255,0.5);">
            NEW</div>
          <div v-else-if="carta.tipo === 'waifu' && getCopie(carta) > 0"
            :style="{ position: 'absolute', top: '-10px', right: '-4px', zIndex: 20, background: getCopie(carta) >= 3 ? 'linear-gradient(135deg,#00c853,#58e0a3)' : 'linear-gradient(135deg,#1a0a35,#2a1255)', border: getCopie(carta) >= 3 ? '2px solid rgba(89,224,163,0.8)' : '2px solid rgba(245,197,96,0.8)', borderRadius: '999px', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ff-mono)', fontSize: '10px', fontWeight: 900, color: '#fff', padding: '0 4px' }">
            {{ getCopie(carta) }}</div>
          <div
            :style="{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: 'linear-gradient(160deg,#16082e,#08041a)', position: 'relative', border: carta.isNuova ? '1.5px solid rgba(0,200,255,0.5)' : '1.5px solid rgba(255,255,255,0.08)' }">
            <img v-if="carta.tipo === 'waifu' && carta.data?.asset_statica"
              :src="ikUrl(carta.data.asset_statica, 'thumbnail') ?? undefined" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
            <img v-else-if="carta.tipo === 'mossa' && carta.data?.asset" :src="carta.data.asset" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;display:block;" />
            <div v-else style="width:100%;height:100%;display:grid;place-items:center;">
              <img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.72;" />
            </div>
            <div v-if="carta.data?.rarita"
              :style="{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '2px 6px', fontFamily: FF.label, fontSize: '8px', fontWeight: 800, color: '#fff', textTransform: 'capitalize' }">
              {{ carta.data.rarita }}</div>
          </div>
          <div
            style="padding:3px 1px 0;text-align:center;font-family:var(--ff-label);font-size:9px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {{ carta.data?.nome || '—' }}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;">
        <div v-for="(carta, ci) in carteRivelate.slice(2)" :key="'s1-' + ci"
          style="width:110px;position:relative;flex-shrink:0;">
          <div v-if="carta.isNuova"
            style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label);font-size:10px;font-weight:900;color:#000;">
            NEW</div>
          <div v-else-if="carta.tipo === 'waifu' && getCopie(carta) > 0"
            :style="{ position: 'absolute', top: '-10px', right: '-4px', zIndex: 20, background: getCopie(carta) >= 3 ? 'linear-gradient(135deg,#00c853,#58e0a3)' : 'linear-gradient(135deg,#1a0a35,#2a1255)', border: getCopie(carta) >= 3 ? '2px solid rgba(89,224,163,0.8)' : '2px solid rgba(245,197,96,0.8)', borderRadius: '999px', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ff-mono)', fontSize: '10px', fontWeight: 900, color: '#fff', padding: '0 4px' }">
            {{ getCopie(carta) }}</div>
          <div
            :style="{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: 'linear-gradient(160deg,#16082e,#08041a)', position: 'relative', border: carta.isNuova ? '1.5px solid rgba(0,200,255,0.5)' : '1.5px solid rgba(255,255,255,0.08)' }">
            <img v-if="carta.tipo === 'waifu' && carta.data?.asset_statica"
              :src="ikUrl(carta.data.asset_statica, 'thumbnail') ?? undefined" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
            <img v-else-if="carta.tipo === 'mossa' && carta.data?.asset" :src="carta.data.asset" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;display:block;" />
            <div v-else style="width:100%;height:100%;display:grid;place-items:center;">
              <img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.72;" />
            </div>
            <div v-if="carta.data?.rarita"
              :style="{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '2px 6px', fontFamily: FF.label, fontSize: '8px', fontWeight: 800, color: '#fff', textTransform: 'capitalize' }">
              {{ carta.data.rarita }}</div>
          </div>
          <div
            style="padding:3px 1px 0;text-align:center;font-family:var(--ff-label);font-size:9px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {{ carta.data?.nome || '—' }}</div>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:14px 20px 40px;text-align:center;position:relative;z-index:10;">
      <button @click="tornaIdle"
        :style="{ padding: '13px 40px', borderRadius: '999px', background: `linear-gradient(135deg,${C.violet},#6938e8)`, border: 'none', color: '#fff', fontFamily: FF.label, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: `0 4px 20px ${C.violet}55` }">✅
        CONTINUA</button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    SUMMARY MULTI PACK
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'summary_multi'" class="fade-in"
    style="position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%);">
    <div style="flex-shrink:0;padding:20px 20px 10px;text-align:center;position:relative;z-index:10;">
      <div
        :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.3em', color: `rgba(245,197,96,0.7)`, textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }">
        RIEPILOGO APERTURA</div>
      <div :style="{ fontFamily: FF.display, fontSize: '18px', fontWeight: 900, color: '#eedcd4', letterSpacing: '2px' }">{{
        multiPackCarte.length }} Pack Aperti</div>
    </div>
    <div
      style="flex:1;overflow-y:auto;padding:12px 16px 8px;display:flex;flex-direction:column;gap:20px;position:relative;z-index:5;">
      <div v-for="(pack, pi) in multiPackCarte" :key="pi"
        :style="{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.inkLine}`, borderRadius: '16px', padding: '14px 12px', position: 'relative' }">
        <div
          :style="{ fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.22em', color: `rgba(245,197,96,0.75)`, textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }">
          Pack {{ pi + 1 }}/{{ multiPackCarte.length }}
          <span :style="{ marginLeft: '8px', color: C.ok, fontSize: '9px' }">+{{pack.filter((c: any) => c.isNuova).length}}
            nuove</span>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;margin-bottom:10px;">
          <div v-for="(carta, ci) in pack.slice(0, 2)" :key="'m' + pi + '-a-' + ci"
            style="width:calc((100% - 20px)/3);max-width:90px;position:relative;flex-shrink:0;">
            <div v-if="carta.isNuova"
              style="position:absolute;top:-8px;left:-3px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:1px 6px;font-family:var(--ff-label);font-size:9px;font-weight:900;color:#000;">
              NEW</div>
            <div
              :style="{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '2/3', background: 'linear-gradient(160deg,#16082e,#08041a)', position: 'relative' }">
              <img v-if="carta.tipo === 'waifu' && carta.data?.asset_statica"
                :src="ikUrl(carta.data.asset_statica, 'thumbnail') ?? undefined" :alt="carta.data?.nome"
                style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
              <div v-else style="width:100%;height:100%;display:grid;place-items:center;">
                <img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.72;" />
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <div v-for="(carta, ci) in pack.slice(2)" :key="'m' + pi + '-b-' + ci"
            style="width:calc((100% - 20px)/3);max-width:90px;position:relative;flex-shrink:0;">
            <div v-if="carta.isNuova"
              style="position:absolute;top:-8px;left:-3px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:1px 6px;font-family:var(--ff-label);font-size:9px;font-weight:900;color:#000;">
              NEW</div>
            <div
              :style="{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '2/3', background: 'linear-gradient(160deg,#16082e,#08041a)', position: 'relative' }">
              <img v-if="carta.tipo === 'waifu' && carta.data?.asset_statica"
                :src="ikUrl(carta.data.asset_statica, 'thumbnail') ?? undefined" :alt="carta.data?.nome"
                style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
              <div v-else style="width:100%;height:100%;display:grid;place-items:center;">
                <img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.72;" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:14px 20px 40px;text-align:center;position:relative;z-index:10;">
      <button @click="tornaIdle"
        :style="{ padding: '13px 40px', borderRadius: '999px', background: `linear-gradient(135deg,${C.violet},#6938e8)`, border: 'none', color: '#fff', fontFamily: FF.label, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer' }">✅
        CONTINUA</button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    IDLE VIEW — HUB SELEZIONE DROP & EMPIRE CAROUSEL (Invariato)
  ══════════════════════════════════════════════════════════════ -->
  <div v-else class="fade-in" :style="{ padding: '10px 0', position: 'relative' }">
    <div :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }">
      <span v-for="i in 4" :key="i"
        :style="{ position: 'absolute', fontSize: `${16 + (i % 2) * 6}px`, opacity: 0.12, top: `${(i * 27) % 90}%`, left: `${(i * 26) % 95}%`, animation: `float ${3.5 + i * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.7}s` }">🌸</span>
    </div>

    <div :style="{ position: 'relative', zIndex: 1 }">
      <div v-if="dropsAttivi.length === 0"
        :style="{ textAlign: 'center', padding: '10px 14px', marginBottom: '14px', background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.inkLine}`, borderRadius: '12px', fontSize: '10px', color: 'rgba(241,235,255,0.45)', fontFamily: FF.label, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }">
        Nessun drop attivo · tutte le carte disponibili</div>

      <!-- CAROSELLO 3D COVERFLOW (Riferimento 5832325319367527884.jpg) -->
      <div v-if="dropsAttivi.length > 0" style="margin-bottom: 20px; padding-top: 4px;">
        <div
          style="font-family: var(--ff-label); font-size: 15px; letter-spacing: 0.22em; color: rgba(245,197,96,0.9); text-transform: uppercase; font-weight: 800; text-align: center; margin-bottom: 20px;">
          ◆ Scegli l'Espansione</div>
        <div style="position: relative; height: 210px; perspective: 900px; overflow: hidden; touch-action: pan-y;"
          @touchstart.passive="cfTouchStart" @touchend.passive="cfTouchEnd">
          <div v-for="(d, i) in dropsAttivi" :key="d.id"
            @click="() => { if (dropSelId === d.id) { if (nOmag > 0) popupApertura = { tipoPacchetto: 'omaggio' }; else if (nBenv > 0) popupApertura = { tipoPacchetto: 'benvenuto' }; else if (nSfid > 0) popupApertura = { tipoPacchetto: 'sfida' }; else sfidaConferma = true; } else { dropSelId = d.id; } }"
            :style="{ position: 'absolute', left: '50%', top: '50%', width: '100px', height: '150px', borderRadius: '12px', cursor: 'pointer', transformStyle: 'preserve-3d', transition: 'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s', boxShadow: d.id === dropSelId ? `0 18px 48px rgba(0,0,0,0.65), 0 0 0 2px ${d.colore || C.violet}, 0 0 28px ${d.colore || C.violet}55` : '0 8px 24px rgba(0,0,0,0.45)', background: `linear-gradient(155deg, ${d.colore || '#a78bfa'} 0%, ${d.colore2 || '#ff85b6'} 50%, #07051a 100%)`, overflow: 'hidden', ...getCoverflowStyle(i) }">
            <div
              style="position:absolute;top:0;left:0;right:0;height:36px;background:linear-gradient(180deg,rgba(0,0,0,0.65) 0%,rgba(0,0,0,0.25) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;">
              <div style="font-family:var(--ff-display);font-size:7px;letter-spacing:3px;color:#f5c560;fontWeight:700;">
                WAIFU'S</div>
            </div>
            <div
              style="position:absolute;top:36px;left:0;right:0;bottom:36px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              <img v-if="d.asset_bustina" :src="d.asset_bustina" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div
              :style="{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: 'linear-gradient(0deg,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.2) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5 }">
              <div :style="{ fontFamily: FF.display, fontSize: '9px', fontWeight: 800, color: '#fff' }">{{
                (d.nome || 'DROP').toUpperCase() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CARDS SELEZIONE PACK PROFILO (Omaggio, Sfida, Benvenuto) -->
      <div
        :style="{ display: 'grid', gridTemplateColumns: `repeat(${nBenv > 0 ? 3 : 2}, minmax(120px, 1fr))`, gap: '10px', justifyContent: 'center', marginBottom: '16px' }">
        <SbustaPackCard tipo="omaggio" :count="nOmag" :max="2" :color="C.gold" :color2="C.goldL" icona="🎁"
          label="OMAGGIO" sub="Gratis ogni 12h" :esaurito="nOmag <= 0" :asset="dropAttivo?.asset_bustina" :ff="FF"
          @click="nOmag > 0 && (popupApertura = { tipoPacchetto: 'omaggio' })" />
        <SbustaPackCard tipo="sfida" :count="nSfid" :max="null" :color="C.sakura" color2="#ff6b6b" icona="⚔"
          label="SFIDA" sub="Vinci in battaglia" :esaurito="nSfid <= 0" :asset="dropAttivo?.asset_bustina" :ff="FF"
          @click="nSfid > 0 && (popupApertura = { tipoPacchetto: 'sfida' })" />
        <SbustaPackCard v-if="nBenv > 0" tipo="benvenuto" :count="nBenv" :max="null" :color="C.ok" color2="#00bfa5"
          icona="⭐" label="BENVENUTO" sub="No doppioni" :esaurito="false" :asset="dropAttivo?.asset_bustina" :ff="FF"
          @click="popupApertura = { tipoPacchetto: 'benvenuto' }" />
      </div>

      <!-- MANGA BANNER COMPILATION STATE -->
      <div v-if="dropAttivo?.asset_manga"
        :style="{ margin: '4px 0 16px', borderRadius: '16px', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, rgba(27,22,56,0.85), rgba(13,10,38,0.92))', border: `1px solid ${C.inkLine}` }">
        <div :style="{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }">
          <div :style="{ flex: 1 }">
            <div :style="{ fontFamily: FF.display, fontSize: '13px', fontWeight: 700, color: '#fff' }">{{
              dropAttivo.nome
              }}</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '9px', color: 'rgba(241,235,255,0.5)', marginTop: '4px' }">{{
              progDrop.possedute }}/{{ progDrop.totale }} carte · {{ progDrop.percentuale }}%</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Modale apertura pack ─────────────────────────────────── -->
  <div v-if="popupApertura" @click="popupApertura = null" :style="{
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(18px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  }">
    <div @click.stop :style="{
      background: 'linear-gradient(180deg, rgba(27,22,56,0.96), rgba(13,10,38,0.98))',
      border: `1.5px solid ${
        popupApertura.tipoPacchetto === 'omaggio' ? C.gold :
        popupApertura.tipoPacchetto === 'sfida'   ? C.sakura : C.ok}55`,
      borderRadius: '18px',
      padding: '24px 26px', maxWidth: '320px', width: '100%', textAlign: 'center',
      boxShadow: `0 24px 50px rgba(3,2,12,0.85), 0 0 36px ${
        popupApertura.tipoPacchetto === 'omaggio' ? C.gold :
        popupApertura.tipoPacchetto === 'sfida'   ? C.sakura : C.ok}22`,
    }">
      <!-- Icona pack -->
      <div :style="{
        width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
        background: `linear-gradient(135deg, ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold + '45' : popupApertura.tipoPacchetto === 'sfida' ? C.sakura + '45' : C.ok + '45'}, transparent)`,
        border: `2px solid ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}66`,
        boxShadow: `0 0 22px ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}44`,
      }">{{ popupApertura.tipoPacchetto === 'omaggio' ? '🎁' : popupApertura.tipoPacchetto === 'sfida' ? '⚔' : '⭐' }}</div>

      <!-- Titolo -->
      <div :style="{ fontFamily: FF.label, fontSize: '14px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px',
        color: popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok }">
        Pacchetto {{ popupApertura.tipoPacchetto === 'omaggio' ? 'OMAGGIO' : popupApertura.tipoPacchetto === 'sfida' ? 'SFIDA' : 'BENVENUTO' }}
      </div>

      <!-- Quantità disponibile -->
      <div :style="{ fontFamily: FF.mono, fontSize: '11px', color: 'rgba(241,235,255,0.45)', marginBottom: '20px' }">
        {{ contaPackPopup }} disponibili
      </div>

      <!-- Pulsanti -->
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }">
        <!-- APRI 1 -->
        <button @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apri(t) }" :style="{
          padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold + ', ' + C.goldL : popupApertura.tipoPacchetto === 'sfida' ? C.sakura + ', #ff6b6b' : C.ok + ', #00bfa5'})`,
          fontFamily: FF.label, fontSize: '12px', fontWeight: 700, color: '#07051a',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }">🎴 APRI 1</button>

        <!-- APRI 10 (solo se ne hai ≥ 2) -->
        <button
          v-if="contaPackPopup >= 2"
          @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apriMulti(t) }" :style="{
          padding: '12px 20px', borderRadius: '12px', cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}66`,
          fontFamily: FF.label, fontSize: '12px', fontWeight: 700,
          color: popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }">🎴×10 APRI TUTTI (max 10)</button>
      </div>

      <!-- Annulla -->
      <button @click="popupApertura = null" :style="{
        background: 'none', border: `1px solid ${C.inkLine}`, borderRadius: '10px',
        color: 'rgba(241,235,255,0.4)', fontFamily: FF.label, fontSize: '10px',
        padding: '10px 20px', cursor: 'pointer', width: '100%',
        letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
      }">Annulla</button>
    </div>
  </div>

  <!-- ── Modale conferma acquisto bustina sfida ─────────────── -->
  <div v-if="sfidaConferma" @click="sfidaConferma = false" :style="{
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(18px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  }">
    <div @click.stop :style="{
      background: 'linear-gradient(180deg, rgba(27,22,56,0.96), rgba(13,10,38,0.98))',
      border: `1.5px solid ${C.sakura}55`, borderRadius: '18px',
      padding: '24px 26px', maxWidth: '320px', width: '100%', textAlign: 'center',
      boxShadow: `0 24px 50px rgba(3,2,12,0.85), 0 0 36px ${C.sakura}33`,
    }">
      <div :style="{ fontFamily: FF.label, fontSize: '11px', color: C.sakura, letterSpacing: '0.32em', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 700 }">Acquista Bustina</div>
      <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.8)', marginBottom: '18px' }">Scegli quante bustine Sfida acquistare:</div>
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '16px' }">
        <button @click="acquistaSfidaConKisses(1)" :style="{
          background: `${C.sakura}1f`, border: `1px solid ${C.sakura}66`, borderRadius: '10px', color: C.sakuraL,
          fontFamily: FF.label, fontSize: '10px', fontWeight: 700, padding: '11px 16px', cursor: 'pointer',
          letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }">🎁 1 bustina · {{ SFIDA_COSTO_KISSES }} Kisses</button>
        <button @click="(profilo?.kisses ?? 0) >= SFIDA_COSTO_10 ? acquistaSfidaConKisses(10) : (sfidaConferma = false, sfidaShortage = true)" :style="{
          background: `linear-gradient(135deg, ${C.gold}26, ${C.sakura}1f)`, border: `1px solid ${C.gold}66`,
          borderRadius: '10px', color: C.goldL, fontFamily: FF.label, fontSize: '10px', fontWeight: 700,
          padding: '11px 16px', cursor: 'pointer', letterSpacing: '0.18em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }">🎁×10 · {{ SFIDA_COSTO_10 }} Kisses</button>
      </div>
      <button @click="sfidaConferma = false" :style="{
        background: 'none', border: `1px solid ${C.inkLine}`, borderRadius: '9px', color: 'rgba(241,235,255,0.5)',
        fontFamily: FF.label, fontSize: '10px', padding: '10px 16px', cursor: 'pointer', width: '100%',
        letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
      }">Annulla</button>
    </div>
  </div>

  <!-- ── Modale kisses insufficienti ───────────────────────── -->
  <KissesShortageModal
    v-if="sfidaShortage"
    :missing-kisses="Math.max(SFIDA_COSTO_KISSES, SFIDA_COSTO_10) - (profilo?.kisses ?? 0)"
    :current-kisses="profilo?.kisses ?? 0"
    @success="(newKisses: number) => { emit('updateProfilo', { kisses: newKisses }); sfidaShortage = false; sfidaConferma = true }"
    @cancel="sfidaShortage = false"
  />
</template>

<!-- STILI ANIMAZIONI NEON E RIVELAZIONE IN PRESERVE-3D -->
<style scoped>
/* Animazione di Strappo Olografico della Bustina */
.booster-pack-wrapper.rip-animation {
  animation: ripOpenEffect 0.8s cubic-bezier(0.45, 0, 0.55, 1) forwards;
}

@keyframes ripOpenEffect {
  0% {
    transform: scale(1) rotate(0deg);
  }

  30% {
    transform: scale(1.05) rotate(-3deg);
  }

  60% {
    transform: translateY(-20px) scale(0.95);
    opacity: 0.8;
  }

  100% {
    transform: translateY(600px) scale(0.4);
    opacity: 0;
  }
}

/* Linea Pulsante di Taglio */
.glow-line {
  animation: laserPulse 1.5s ease-in-out infinite;
}

@keyframes laserPulse {

  0%,
  100% {
    opacity: 0.6;
    box-shadow: 0 0 10px #00ffff;
  }

  50% {
    opacity: 1;
    box-shadow: 0 0 25px #00ffff, 0 0 40px #00ffff;
  }
}

/* Splendida Animazione di Swipe/Uscita Carta Principale (Pokémon Pocket Style) */
.main-reveal-card-container.slide-out-animation {
  animation: cardSlideUpAway 0.38s cubic-bezier(0.3, 0.8, 0.4, 1) forwards;
}

@keyframes cardSlideUpAway {
  0% {
    transform: translateY(0) translateZ(0) rotateX(0);
    opacity: 1;
  }

  100% {
    transform: translateY(-500px) translateZ(150px) rotateX(-25deg);
    opacity: 0;
  }
}

@keyframes pulseSoft {

  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}
</style>
