<!-- ============================================================
  Tab Sbusta: apertura pacchetti gacha (omaggio, benvenuto, sfida).
  Gestisce la rivelazione animata delle carte, i drop stagionali,
  i God Pack e l'acquisto bustine con Kisses.
  Equivalente di src/app/gioco/_redesign/Sbusta.jsx
  ============================================================ -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useTemplateRef } from 'vue'
import type { ProfiloUtente, Collezione, WaifuCatalog, MossaCatalog } from '~/types/game'
import {
  listDropsAttivi,
  updateUserProfile,
  setCollezione as saveCollezione,
  createPackSnapshot,
} from '~/utils/firestoreService'
import { generaPacchetto, GOD_PACK_PROB_DEFAULT } from '~/utils/gameLogic'
import { TIMER } from '~/utils/constants'
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
  notif:            [testo: string, colore: string]
  updateProfilo:    [p: unknown]
  updateCollezione: [c: unknown]
  setTab:           [tab: string]
  indietro:         [] // chiude l'overlay quando aperto da HomeTab
}>()

const authStore = useAuthStore()

// ── Anti-FOUC: overlay full-page finché la bustina 3D non ha renderizzato ──
// Aspetta che un <canvas> Three.js compaia e abbia dimensioni reali.
const { isPageReady } = usePageReady('canvas')

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
    if (lista.length > 0) dropSelId.value = lista[0].id as string
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

const dropColore = computed(() => dropAttivo.value?.colore || C.violet)

const SFIDA_COSTO_KISSES = 50
const SFIDA_COSTO_10 = 450

const nBenv = computed(() => Number(props.profilo?.pacchettiBenvenuto ?? 0))
const nOmag = computed(() => Number(props.profilo?.pacchettiOmaggio ?? 0))
const nSfid = computed(() => Number(props.profilo?.pacchettiSfida ?? 0))

// Totale pacchetti disponibili (somma di tutti i tipi — usato nella nuova idle page)
const totalePacchetti = computed(() => nOmag.value + nBenv.value + nSfid.value)

// Tipo da aprire: priorità omaggio → benvenuto → sfida
const tipoDaAprire = computed<string>(() => {
  if (nOmag.value > 0) return 'omaggio'
  if (nBenv.value > 0) return 'benvenuto'
  if (nSfid.value > 0) return 'sfida'
  return 'omaggio'
})

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

// Precaricare tutte le immagini delle carte prima che l'utente inizi
// a rivelare. Viene chiamato subito dopo aver generato i pacchetti, così
// durante l'animazione del pack (800ms) + il delay iniziale (500ms) le
// immagini sono già nella cache HTTP e appaiono istantaneamente.
function preloadCarteImages(pacchetti: any[][]) {
  if (typeof window === 'undefined') return
  try {
    const urls = new Set<string>()
    for (const carte of pacchetti) {
      for (const c of carte) {
        if (c.tipo !== 'waifu') continue
        const w = c.data
        // preset 'normal' → dimensione CartaWaifu di default nel reveal
        const s = ikUrl(w?.asset_statica ?? null, 'normal')
        if (s) urls.add(s)
        // leggendario/immersivo usano anche asset_immersiva
        if ((w?.rarita === 'leggendario' || w?.rarita === 'immersivo') && w?.asset_immersiva) {
          const i = ikUrl(w.asset_immersiva, 'normal')
          if (i) urls.add(i)
        }
      }
    }
    urls.forEach(url => { const img = new Image(); img.src = url })
  } catch { /* mai propagare errori di preload */ }
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

  // Preload immediato: le immagini arrivano durante l'animazione del pack (≥1.3s)
  preloadCarteImages([carte])

  // Notifica il sistema missioni giornaliere: pacchetto aperto
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mission:progress', { detail: { key: 'open_pack', amount: 1 } }))
    // Controlla se ci sono carte leggendarie nel pacchetto appena aperto
    const hasLegendary = carte.some((c: any) => c.tipo === 'waifu' && c.data?.rarita === 'leggendario')
    if (hasLegendary) window.dispatchEvent(new CustomEvent('mission:progress', { detail: { key: 'legendary', amount: 1 } }))
  }

  emit('updateCollezione', nuova)
  try {
    await saveCollezione(uid, nuova as any)
    if (tipoPacchetto === 'benvenuto') {
      const n = Number(props.profilo?.pacchettiBenvenuto ?? 0) - 1
      emit('updateProfilo', { pacchettiBenvenuto: n })
      await updateUserProfile(uid, { pacchettiBenvenuto: n })
    } else if (tipoPacchetto === 'omaggio') {
      const n = Number(props.profilo?.pacchettiOmaggio ?? 0) - 1
      emit('updateProfilo', { pacchettiOmaggio: n })
      await updateUserProfile(uid, { pacchettiOmaggio: n })
    } else {
      const n = Number(props.profilo?.pacchettiSfida ?? 0) - 1
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
    ? Number(props.profilo?.pacchettiBenvenuto ?? 0)
    : tipoPacchetto === 'omaggio'
      ? Number(props.profilo?.pacchettiOmaggio ?? 0)
      : Number(props.profilo?.pacchettiSfida ?? 0)
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

  // Preload di TUTTE le immagini dei pack (fino a 10×5=50 carte)
  // Il browser le carica in parallelo mentre l'utente guarda il primo pack
  preloadCarteImages(tuttiIPacchetti)

  const prime = tuttiIPacchetti[0]
  const gp = prime.length === 5 && prime.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value = prime
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  stato.value = 'reveal_multi'

  // Notifica missioni giornaliere: N pacchetti aperti + eventuali leggendarie
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mission:progress', { detail: { key: 'open_pack', amount: tuttiIPacchetti.length } }))
    const legCount = tuttiIPacchetti.flat().filter((c: any) => c.tipo === 'waifu' && c.data?.rarita === 'leggendario').length
    if (legCount > 0) window.dispatchEvent(new CustomEvent('mission:progress', { detail: { key: 'legendary', amount: legCount } }))
  }

  emit('updateCollezione', nuova)
  try {
    await saveCollezione(uid, nuova as any)
    if (tipoPacchetto === 'benvenuto') {
      const n = Number(props.profilo?.pacchettiBenvenuto ?? 0) - tuttiIPacchetti.length
      emit('updateProfilo', { pacchettiBenvenuto: n })
      await updateUserProfile(uid, { pacchettiBenvenuto: n })
    } else if (tipoPacchetto === 'omaggio') {
      const n = Number(props.profilo?.pacchettiOmaggio ?? 0) - tuttiIPacchetti.length
      emit('updateProfilo', { pacchettiOmaggio: n })
      await updateUserProfile(uid, { pacchettiOmaggio: n })
    } else {
      const n = Number(props.profilo?.pacchettiSfida ?? 0) - tuttiIPacchetti.length
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

// Schema colore del popup sincronizzato col pack cliccato
const popupColor = computed(() => {
  const t = popupApertura.value?.tipoPacchetto
  if (t === 'omaggio') return {
    main: C.gold,
    border: 'rgba(220,182,55,0.92)',
    bg: 'linear-gradient(165deg,#1e1a08 0%,#12100a 55%,#090805 100%)',
    glow: 'rgba(220,175,40,0.28)',
    btn1: 'linear-gradient(180deg,#8a6808 0%,#5a4205 100%)',
    btn1txt: '#fff8dc',
    btn2bg: '#1a1408',
    btn2border: 'rgba(200,155,40,0.7)',
    btn2txt: '#e8c448',
    cornerColor: 'rgba(220,182,55,0.95)',
  }
  if (t === 'sfida') return {
    main: C.sakura,
    border: 'rgba(220,100,148,0.92)',
    bg: 'linear-gradient(165deg,#200818 0%,#15060f 55%,#0c040a 100%)',
    glow: 'rgba(220,100,148,0.26)',
    btn1: 'linear-gradient(180deg,#9e2232 0%,#6b1020 100%)',
    btn1txt: '#ffd050',
    btn2bg: '#160810',
    btn2border: 'rgba(200,90,130,0.7)',
    btn2txt: '#ff85b6',
    cornerColor: 'rgba(220,100,148,0.95)',
  }
  return {
    main: C.ok,
    border: 'rgba(70,200,145,0.92)',
    bg: 'linear-gradient(165deg,#081e14 0%,#06140d 55%,#040c09 100%)',
    glow: 'rgba(70,200,145,0.26)',
    btn1: 'linear-gradient(180deg,#0a5c30 0%,#063d1f 100%)',
    btn1txt: '#d0ffe8',
    btn2bg: '#06140d',
    btn2border: 'rgba(60,185,130,0.7)',
    btn2txt: '#58e0a3',
    cornerColor: 'rgba(70,200,145,0.95)',
  }
})

function getCopie(carta: any): number {
  if (!carta || carta.tipo !== 'waifu') return 0
  return (props.collezione?.waifu as any)?.[carta.data?.id]?.copie ?? 0
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
    const data = await ($fetch as any)(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const spent = data.kissesCost ?? (qty === 10 ? SFIDA_COSTO_10 : SFIDA_COSTO_KISSES)
    const newKisses = Math.max(0, Number(props.profilo?.kisses ?? 0) - spent)
    const pAgg = data.pacchettiAggiunti ?? qty
    const newSfid = Number(props.profilo?.pacchettiSfida ?? 0) + pAgg
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


const selectedDropIndex = computed(() =>
  Math.max(0, dropsAttivi.value.findIndex(d => d.id === dropSelId.value))
)


function getCoverflowStyle(index: number): Record<string, string | number> {
  const dist = index - selectedDropIndex.value
  const STEP = 130
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
  <!-- Overlay anti-FOUC: copre tutto finché la bustina 3D non è renderizzata -->
  <PageLoadingOverlay :ready="isPageReady" />

  <!-- SKELETON LOADING — full-screen fixed, usato quando SbustaTab è overlay -->
  <div v-if="dropsLoading" class="fade-in"
    style="position:fixed;inset:0;z-index:200;background:var(--theme-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
    <img src="~/assets/images/New_Logo.png" alt="" style="width:72px;height:auto;animation:pulse 1.2s ease-in-out infinite;opacity:0.75;" />
    <div :style="{ fontFamily: FF.label, fontSize:'13px', letterSpacing:'0.24em', color:'var(--theme-text-3)', textTransform:'uppercase', fontWeight:700 }">
      Caricamento espansioni…
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    REVEAL VIEW — Pokémon Pocket Style Pack Opening & 3D Stack
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'reveal' || stato === 'reveal_multi'"
    style="position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; background:var(--theme-bg); perspective: 1200px;">

    <!-- 1. FASE DI SBUSTO INTERATTIVA (Prima di mostrare le carte) -->
    <div v-if="!bustaAperta"
      :style="{
        position:'absolute', inset:0, zIndex:250,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:`radial-gradient(circle at center, ${dropColore}28 0%, transparent 100%)`,
        cursor:'pointer',
      }"
      @click="eseguiTaglioBustina">
      <div style="text-align: center; margin-bottom: 32px; padding: 0 30px; animation: pulseSoft 2s infinite;">
        <p :style="{ fontFamily: FF.label, fontSize: '15px', color: 'var(--theme-text-2)', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700 }">
          ▶ Tocca per aprire
        </p>
      </div>

      <!-- Corpo del Pacchetto 3D — colore dell'espansione selezionata, più grande -->
      <div :class="['booster-pack-wrapper', { 'rip-animation': bustaInAnimazione }]"
        style="position: relative; display: inline-block;">
        <BustinaGLB
          :texture-url="dropAttivo?.asset_bustina ?? null"
          :color="dropColore"
          :ripping="bustaInAnimazione"
          :width="280" :height="460"
        />
        <!-- Linea Neon di Taglio — commentata: apertura solo con tap, non swipe -->
        <!-- <div class="glow-line"
          style="position: absolute; top: 80px; left: 0; right: 0; height: 3px; background: #00ffff; box-shadow: 0 0 15px #00ffff, 0 0 30px #00ffff; z-index: 10; pointer-events:none;" /> -->
      </div>
    </div>

    <!-- 2. STACK DI CARTE REALI DIETRO + INTERAZIONE INTERFACCIA -->
    <template v-else>
      <div
        :style="{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${raritaGlow(cartaCorrente)}26 0%, transparent 65%)`, transition: 'background 0.5s ease' }" />

      <!-- Top Header Progress -->
      <div style="position: relative; z-index: 10; padding: 20px 20px 0; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px;">
          <div v-for="(_, i) in carteRivelate" :key="i" :style="{
            width: i <= indiceRivelato ? '28px' : '8px',
            height: '6px',
            borderRadius: '999px',
            background: i < indiceRivelato ? 'rgba(255,255,255,0.4)' : i === indiceRivelato ? raritaGlow(cartaCorrente) : 'rgba(255,255,255,0.15)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: i === indiceRivelato ? `0 0 12px ${raritaGlow(cartaCorrente)}` : 'none',
          }" />
        </div>
        <div
          :style="{ fontFamily: FF.label, fontSize: '16px', color: C.violet, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }">
          <template v-if="stato === 'reveal_multi'">Pacchetto {{ multiPackIndice + 1 }}/{{ multiPackCarte.length }} ·
          </template>
          Carta {{ Math.max(1, indiceRivelato + 1) }} di {{ carteRivelate.length }}
        </div>
      </div>

      <!-- Area Centrale di Gioco delle Carte -->
      <div
        style="position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; z-index: 5;"
        @click="indiceRivelato < carteRivelate.length - 1 ? avanzaCartaManuale() : mostraRiepilogo()">

        <!-- CARTA PRINCIPALE — centrata dal flex, nessun overflow hidden sopra -->
        <div v-if="cartaCorrente && indiceRivelato >= 0"
          :class="['main-reveal-card-container', { 'slide-out-animation': transizioneCarta }]"
          style="position: relative; z-index: 100; perspective: 1000px;"
          @mousemove="onRevealMouseMove" @mouseleave="onRevealMouseLeave"
          @touchstart.passive="onRevealTouchStart" @touchmove.passive="onRevealTouchMove" @touchend.passive="onRevealTouchEnd">
          <!-- Badge NEW — visibile sopra tutto, nessun overflow che lo taglia -->
          <div v-if="cartaCorrente.isNuova"
            style="position:absolute;top:-28px;left:-10px;z-index:200;background:linear-gradient(135deg,#00b4ff,#00e676);border:2.5px solid #fff;border-radius:999px;padding:5px 16px;font-family:var(--ff-label);font-size:15px;font-weight:900;color:#000;box-shadow:0 4px 16px rgba(0,180,255,0.65);pointer-events:none;">
            NEW</div>
          <div v-else-if="cartaCorrente.tipo === 'waifu'"
            style="position:absolute;top:-22px;right:-12px;z-index:200;background:linear-gradient(135deg,#1a0a35,#2a1255);border:2.5px solid #f5c560;border-radius:999px;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-family:var(--ff-mono);font-size:14px;font-weight:900;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,0.5);pointer-events:none;">
            {{ copieCartaCorrente }}</div>
          <!-- Aura glow -->
          <div :style="{ position:'absolute', inset:'-15px', borderRadius:'25px', background:`radial-gradient(circle,${raritaGlow(cartaCorrente)}3b 0%,transparent 70%)`, pointerEvents:'none' }" />
          <!-- Tilt 3D -->
          <div :style="{
            transform: `rotateX(${revealTilt.x}deg) rotateY(${revealTilt.y}deg) scale(1.02)`,
            transformStyle: 'preserve-3d',
            transition: revealDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)',
            willChange: 'transform',
          }">
            <CartaWaifu v-if="cartaCorrente.tipo === 'waifu'" :waifu="cartaCorrente.data" dimensione="normale" tipo="auto" />
            <CartaMossa v-else-if="cartaCorrente.tipo === 'mossa'" :mossa="cartaCorrente.data" dimensione="normale" />
          </div>
        </div>

        <!-- Feedback UI (fuori dall'overflow:hidden) -->
        <div v-if="levelUpDisponibile && indiceRivelato >= 0"
          style="margin-top:14px;padding:8px 22px;border-radius:999px;background:#ffffff;border:1.5px solid rgba(89,224,163,0.5);font-family:var(--ff-label);font-size:14px;font-weight:800;color:#16a34a;letter-spacing:0.14em;text-transform:uppercase;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.15);">
          ⚡ Aumento di livello disponibile
        </div>
        <div v-if="indiceRivelato >= carteRivelate.length - 1"
          style="margin-top:18px;font-family:var(--ff-label);font-size:11px;letter-spacing:0.22em;color:var(--theme-text-3);text-transform:uppercase;animation:pulseSoft 1.6s ease-in-out infinite;pointer-events:none;">
          Tocca per il riepilogo →
        </div>
      </div>
    </template>

    <!-- Overlay Video Immersivo Sezione Sblocchi -->
    <div v-if="sbusVideoAttivo && sbusCartaImmersiva" @click="sbusVideoFinito ? chiudiVideoSbusto() : undefined"
      style="position: fixed; inset: 0; background: var(--theme-surface); backdrop-filter: blur(20px); z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center;">
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
    style="position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;overflow:hidden;background:var(--theme-bg);">
    <div
      :style="{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(ellipse 80% 50% at 50% 30%,${C.violet}18 0%,transparent 65%)` }" />
    <div style="flex-shrink:0;padding:24px 20px 12px;text-align:center;position:relative;z-index:10;">
      <div
        :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.3em', color: C.violet, textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }">
        CARTE OTTENUTE</div>
      <div :style="{ fontFamily: FF.display, fontSize: '22px', fontWeight: 900, color: 'var(--theme-text)', letterSpacing: '2px' }">
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
            :style="{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: 'var(--theme-bg-secondary)', position: 'relative', border: carta.isNuova ? '1.5px solid rgba(0,200,255,0.5)' : '1.5px solid rgba(255,255,255,0.08)' }">
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
            style="padding:3px 1px 0;text-align:center;font-family:var(--ff-label);font-size:12px;color:var(--theme-text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
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
            :style="{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '2/3', background: 'var(--theme-bg-secondary)', position: 'relative', border: carta.isNuova ? '1.5px solid rgba(0,200,255,0.5)' : '1.5px solid rgba(255,255,255,0.08)' }">
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
            style="padding:3px 1px 0;text-align:center;font-family:var(--ff-label);font-size:12px;color:var(--theme-text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {{ carta.data?.nome || '—' }}</div>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:14px 20px 40px;text-align:center;position:relative;z-index:10;">
      <button @click="tornaIdle"
        :style="{ padding: '16px', width: '100%', borderRadius: '999px', background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', color: '#fff', fontFamily: FF.label, fontSize: '17px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 6px 24px rgba(34,197,94,0.45)' }">
        CONTINUA</button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    SUMMARY MULTI PACK
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'summary_multi'" class="fade-in"
    style="position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;overflow:hidden;background:var(--theme-bg);">
    <div style="flex-shrink:0;padding:20px 20px 10px;text-align:center;position:relative;z-index:10;">
      <div
        :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.3em', color: C.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }">
        RIEPILOGO APERTURA</div>
      <div :style="{ fontFamily: FF.display, fontSize: '18px', fontWeight: 900, color: 'var(--theme-text)', letterSpacing: '2px' }">{{
        multiPackCarte.length }} Pack Aperti</div>
    </div>
    <div
      style="flex:1;overflow-y:auto;padding:12px 16px 8px;display:flex;flex-direction:column;gap:20px;position:relative;z-index:5;">
      <div v-for="(pack, pi) in multiPackCarte" :key="pi"
        :style="{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.inkLine}`, borderRadius: '16px', padding: '14px 12px', position: 'relative' }">
        <div
          :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }">
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
              :style="{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '2/3', background: 'var(--theme-bg-secondary)', position: 'relative' }">
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
              :style="{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '2/3', background: 'var(--theme-bg-secondary)', position: 'relative' }">
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
    IDLE VIEW — Pagina apertura pacchetti (full-screen fixed).
    Layout: header ←/titolo | carosello espansioni | bottoni APRI 1 / APRI 10 | contatore totale.
    Le schede OMAGGIO/SFIDA/BENVENUTO sono eliminate: il totale è unico.
  ══════════════════════════════════════════════════════════════ -->
  <div v-else class="fade-in"
    style="position:fixed;inset:0;z-index:200;background:var(--theme-bg);display:flex;flex-direction:column;overflow:hidden;">

    <!-- Layer colore espansione — rgba() garantisce supporto universale, stop finale a opacity 0 elimina qualsiasi bordo -->
    <div
      style="position:absolute;inset:0;pointer-events:none;z-index:0;"
      :style="{
        backgroundImage: `radial-gradient(ellipse 500% 500% at 50% 50%, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 100%)`
      }"
    />

    <!-- Petali sakura decorativi sfondo -->
    <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1;">
      <span v-for="i in 4" :key="i"
        :style="{ position:'absolute', fontSize:`${16+(i%2)*6}px`, opacity:0.08, top:`${(i*27)%90}%`, left:`${(i*26)%95}%`, animation:`float ${3.5+i*0.5}s ease-in-out infinite`, animationDelay:`${i*0.7}s` }">🌸</span>
    </div>

    <!-- Contenuto principale centrato verticalmente come gruppo -->
    <div style="position:relative;z-index:2;display:flex;flex-direction:column;height:100%;padding:0 16px;">

      <!-- Header: ← a sinistra, titolo centrato, spacer a destra -->
      <div style="display:flex;align-items:center;padding:14px 0 10px;flex-shrink:0;">
        <button @click="emit('indietro')"
          style="background:transparent;border:1.5px solid #a78bfa;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:#a78bfa;flex-shrink:0;line-height:1;">←</button>
        <div :style="{ flex:1, textAlign:'center', fontFamily:FF.label, fontSize:'16px', letterSpacing:'0.24em', color:C.violet, textTransform:'uppercase', fontWeight:800 }">
          ◆ Scegli l'Espansione
        </div>
        <div style="width:38px;flex-shrink:0;"></div>
      </div>

      <!-- Messaggio nessun drop attivo -->
      <div v-if="dropsAttivi.length === 0"
        style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;"
        :style="{ fontFamily:FF.label, fontSize:'11px', letterSpacing:'0.22em', color:'var(--theme-text-3)', textTransform:'uppercase', fontWeight:700 }">
        Nessun drop attivo · tutte le carte disponibili
      </div>

      <!-- Blocco centrale: carosello + bottoni + contatore, centrato come gruppo -->
      <div v-if="dropsAttivi.length > 0" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;min-height:0;">

        <!-- Carosello 3D coverflow — bustine grandi senza card wrapper -->
        <div style="position:relative;width:100%;height:420px;perspective:1400px;overflow:visible;touch-action:pan-y;flex-shrink:0;"
          @touchstart.passive="cfTouchStart" @touchend.passive="cfTouchEnd">
          <div v-for="(d, i) in dropsAttivi" :key="d.id"
            @click="() => dropSelId = d.id"
            :style="{
              position:'absolute', left:'50%', top:'50%',
              width:'185px', height:'300px',
              cursor:'pointer',
              transition:'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s, filter 0.42s',
              filter: d.id===dropSelId ? `drop-shadow(0 0 32px ${d.colore||C.violet}99)` : 'none',
              ...getCoverflowStyle(i),
            }">
            <!-- Bustina 3D per TUTTE le espansioni — label orizzontale sotto -->
            <BustinaGLB
              :color="d.colore || C.violet"
              :texture-url="null"
              :label="(d.nome||'DROP').toUpperCase()"
              :label-color="d.id===dropSelId ? (d.colore||'#e8c448') : 'rgba(255,255,255,0.45)'"
              :width="185" :height="300"
            />
          </div>
        </div>

        <!-- Bottoni APRI 1 / APRI 10 + contatore — subito sotto la carta -->
        <div style="width:100%;flex-shrink:0;">
          <div style="display:flex;gap:12px;margin-bottom:14px;">

            <!-- APRI 1 -->
            <button
              @click="totalePacchetti > 0 && apri(tipoDaAprire)"
              :disabled="totalePacchetti === 0"
              :style="{
                flex:1, padding:'15px 8px', borderRadius:'999px', border:'none',
                cursor: totalePacchetti > 0 ? 'pointer' : 'not-allowed',
                background: totalePacchetti > 0 ? `linear-gradient(135deg,${C.sakura},#c54a86)` : 'rgba(255,255,255,0.06)',
                boxShadow: totalePacchetti > 0 ? `0 6px 28px ${C.sakura}55` : 'none',
                fontFamily: FF.display, fontSize:'15px', fontWeight:800,
                color: totalePacchetti > 0 ? '#fff' : 'var(--theme-text-3)',
                letterSpacing:'0.1em', textTransform:'uppercase',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: totalePacchetti > 0 ? 1 : 0.4, transition:'opacity 0.2s',
              }">APRI 1</button>

            <!-- APRI 10 -->
            <button
              @click="totalePacchetti > 0 && apriMulti(tipoDaAprire)"
              :disabled="totalePacchetti === 0"
              :style="{
                flex:1, padding:'15px 8px', borderRadius:'999px', border:'none',
                cursor: totalePacchetti > 0 ? 'pointer' : 'not-allowed',
                background: totalePacchetti > 0 ? `linear-gradient(135deg,${C.violet},#6938e8)` : 'rgba(255,255,255,0.06)',
                boxShadow: totalePacchetti > 0 ? `0 6px 28px ${C.violet}55` : 'none',
                fontFamily: FF.display, fontSize:'14px', fontWeight:800,
                color: totalePacchetti > 0 ? '#fff' : 'var(--theme-text-3)',
                letterSpacing:'0.08em', textTransform:'uppercase',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: totalePacchetti > 0 ? 1 : 0.4, transition:'opacity 0.2s',
              }">APRI 10</button>

          </div>

          <!-- Contatore totale -->
          <div style="text-align:center;padding:2px 0;">
            <template v-if="totalePacchetti > 0">
              <span :style="{ fontFamily:FF.label, fontSize:'22px', fontWeight:900, color:C.gold }">{{ totalePacchetti }}</span>
              <span :style="{ fontFamily:FF.label, fontSize:'12px', letterSpacing:'0.16em', color:'var(--theme-text-3)', marginLeft:'8px', textTransform:'uppercase' }">pacchetti disponibili</span>
            </template>
            <template v-else>
              <span :style="{ fontFamily:FF.label, fontSize:'12px', letterSpacing:'0.16em', color:'var(--theme-text-3)', textTransform:'uppercase' }">nessun pacchetto disponibile</span>
            </template>
          </div>
        </div>

      </div>

    </div>
  </div>

  <!-- ── Modale apertura pack — stile game premium ───────────── -->
  <div v-if="popupApertura" @click="popupApertura = null"
    style="position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.72);backdrop-filter:blur(24px);">
    <div @click.stop :style="{position:'relative',maxWidth:'310px',width:'100%',textAlign:'center',padding:'36px 26px 26px',borderRadius:'18px',background:popupColor.bg,border:`1.5px solid ${popupColor.border}`,boxShadow:`0 0 80px ${popupColor.glow},0 30px 70px rgba(0,0,0,0.85),inset 0 1px 0 rgba(255,255,255,0.05)`,overflow:'hidden'}">

      <!-- Stelle di sfondo animate colorate -->
      <div v-for="s in [8,17,29,43,56,71,82,91,37,65,14,78]" :key="s"
        :style="{position:'absolute',width:'2px',height:'2px',borderRadius:'50%',background:`${popupColor.main}99`,top:`${(s*7)%88}%`,left:`${(s*11)%92}%`,animation:`pulseSoft ${1.4+s%3*0.5}s ease-in-out infinite`,animationDelay:`${(s*0.13)%2}s`,pointerEvents:'none'}" />

      <!-- Glow dietro icona -->
      <div :style="{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'220px',height:'150px',background:`radial-gradient(ellipse at 50% 35%,${popupColor.glow} 0%,transparent 70%)`,pointerEvents:'none'}" />

      <!-- Angoli decorativi colorati -->
      <div :style="{position:'absolute',top:'10px',left:'10px',width:'22px',height:'22px',borderTop:`2px solid ${popupColor.cornerColor}`,borderLeft:`2px solid ${popupColor.cornerColor}`,borderRadius:'3px 0 0 0'}" />
      <div :style="{position:'absolute',top:'10px',right:'10px',width:'22px',height:'22px',borderTop:`2px solid ${popupColor.cornerColor}`,borderRight:`2px solid ${popupColor.cornerColor}`,borderRadius:'0 3px 0 0'}" />
      <div :style="{position:'absolute',bottom:'10px',left:'10px',width:'22px',height:'22px',borderBottom:`2px solid ${popupColor.cornerColor}`,borderLeft:`2px solid ${popupColor.cornerColor}`,borderRadius:'0 0 0 3px'}" />
      <div :style="{position:'absolute',bottom:'10px',right:'10px',width:'22px',height:'22px',borderBottom:`2px solid ${popupColor.cornerColor}`,borderRight:`2px solid ${popupColor.cornerColor}`,borderRadius:'0 0 3px 0'}" />

      <!-- Icona con piattaforma luminosa -->
      <div style="position:relative;z-index:1;margin-bottom:18px;">
        <div style="position:relative;width:90px;height:90px;margin:0 auto;display:flex;align-items:center;justify-content:center;">
          <div :style="{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'70px',height:'10px',background:popupColor.glow,borderRadius:'50%',filter:'blur(6px)'}" />
          <span :style="{fontSize:'52px',lineHeight:1,filter:`drop-shadow(0 0 22px ${popupColor.main}dd) drop-shadow(0 4px 10px rgba(0,0,0,0.6))`,position:'relative',zIndex:1}">{{ popupApertura.tipoPacchetto === 'omaggio' ? '🎁' : popupApertura.tipoPacchetto === 'sfida' ? '⚔️' : '⭐' }}</span>
        </div>
      </div>

      <!-- Titolo -->
      <div :style="{fontFamily:`var(--ff-display,'Unbounded',sans-serif)`,fontSize:'17px',fontWeight:900,letterSpacing:'0.1em',color:popupColor.main,textTransform:'uppercase',marginBottom:'5px',textShadow:`0 0 22px ${popupColor.main}88`}">
        PACCHETTO {{ popupApertura.tipoPacchetto === 'omaggio' ? 'OMAGGIO' : popupApertura.tipoPacchetto === 'sfida' ? 'SFIDA' : 'BENVENUTO' }}
      </div>

      <!-- Quantità -->
      <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:12px;color:rgba(148,192,232,0.75);margin-bottom:26px;letter-spacing:0.04em;">
        {{ contaPackPopup }} disponibili
      </div>

      <!-- Bottoni -->
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
        <!-- APRI 1 -->
        <button @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apri(t) }"
          :style="{width:'100%',padding:'15px 24px',borderRadius:'999px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',background:popupColor.btn1,border:`1.5px solid ${popupColor.border}`,boxShadow:`0 4px 24px ${popupColor.glow},inset 0 1px 0 rgba(255,255,255,0.1)`,fontFamily:`var(--ff-display,'Unbounded',sans-serif)`,fontSize:'15px',fontWeight:800,color:popupColor.btn1txt,letterSpacing:'0.12em',textTransform:'uppercase'}">
          <span style="font-size:18px;line-height:1;">🃏</span> APRI 1
        </button>
        <!-- APRI 10 -->
        <button v-if="contaPackPopup >= 2"
          @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apriMulti(t) }"
          :style="{width:'100%',padding:'15px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',background:popupColor.btn2bg,border:`1.5px solid ${popupColor.btn2border}`,boxShadow:`0 4px 18px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.04)`,fontFamily:`var(--ff-display,'Unbounded',sans-serif)`,fontSize:'13px',fontWeight:800,color:popupColor.btn2txt,letterSpacing:'0.08em',textTransform:'uppercase',borderRadius:'8px',clipPath:'polygon(14px 0%,calc(100% - 14px) 0%,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0% calc(100% - 14px),0% 14px)'}">
          <span style="font-size:18px;line-height:1;">🃏</span> ×10 APRI TUTTI
        </button>
      </div>

      <!-- Annulla -->
      <button @click="popupApertura = null"
        style="background:none;border:none;cursor:pointer;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(170,195,225,0.4);font-weight:600;padding:4px;">
        ANNULLA
      </button>
    </div>
  </div>

  <!-- ── Modale conferma acquisto bustina sfida ─────────────── -->
  <div v-if="sfidaConferma" @click="sfidaConferma = false" :style="{
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'var(--theme-surface)', backdropFilter: 'blur(18px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  }">
    <div @click.stop :style="{
      background: 'var(--surface)',
      border: `1.5px solid ${C.sakura}55`, borderRadius: '18px',
      padding: '24px 26px', maxWidth: '320px', width: '100%', textAlign: 'center',
      boxShadow: `var(--shadow-card-p), 0 0 36px ${C.sakura}33`,
    }">
      <div :style="{ fontFamily: FF.label, fontSize: '11px', color: C.sakura, letterSpacing: '0.32em', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 700 }">Acquista Bustina</div>
      <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', marginBottom: '18px' }">Scegli quante bustine Sfida acquistare:</div>
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

/* ── Pocket theme overrides per SbustaTab ── */
/* Il chrome usa var(--theme-*) — il contenuto (pack, carte) mantiene i colori game */
</style>
