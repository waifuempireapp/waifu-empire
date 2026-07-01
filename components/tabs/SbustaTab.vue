<!-- ============================================================
  Tab Sbusta: apertura pacchetti gacha (omaggio, benvenuto, sfida).
  Gestisce la rivelazione animata delle carte, i drop stagionali,
  i God Pack e l'acquisto bustine con Kisses.
  Equivalente di src/app/gioco/_redesign/Sbusta.jsx
  ============================================================ -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, useTemplateRef } from 'vue'
import { FastForward } from 'lucide-vue-next'
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
import { useMissionsStore } from '~/stores/missions'
import { ikUrl } from '~/utils/imagekitUrl'
import MoveCard from '~/components/moves/MoveCard.vue'

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

const authStore      = useAuthStore()
const missionsStore  = useMissionsStore()
const { t } = useI18n()

// Immagine (thumbnail) di una carta del riepilogo — gestisce waifu E mosse.
function cardImg(carta: any): string | undefined {
  const d = carta?.data ?? {}
  if (carta?.tipo === 'mossa') return ikUrl(d.immagine ?? d.immagine_url ?? d.imageUrl ?? null, 'thumbnail') ?? undefined
  return ikUrl(d.asset_statica ?? d.asset_immersiva ?? d.immagine ?? null, 'thumbnail') ?? undefined
}

// ── Anti-FOUC: overlay full-page finché la bustina 3D non ha renderizzato ──
// Aspetta che un <canvas> Three.js compaia e abbia dimensioni reali.
// recheck() ri-mostra l'overlay quando si entra nella schermata di apertura
// ("Tocca per aprire") che monta una NUOVA bustina 3D più grande.
const { isPageReady, recheck: recheckPageReady } = usePageReady('canvas')

// ── Stato principale ─────────────────────────────────────────
const stato = ref<'idle' | 'reveal' | 'reveal_multi' | 'summary' | 'summary_multi'>('idle')

// Entrando nello stato di apertura ("Tocca per aprire") viene montata una nuova
// BustinaGLB: ri-mostra l'overlay anti-FOUC finché il nuovo canvas non è renderizzato.
watch(stato, (s) => {
  if (s === 'reveal' || s === 'reveal_multi') recheckPageReady()
})
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

// ── APRI 10: tre fasi (stack fermo → uscita una alla volta → reveal a gruppi di 5) ──
const multiPhase = ref<'stack' | 'exiting' | 'revealing'>('stack')
const multiExitedCount = ref(0)     // quante bustine sono già uscite
const multiPackDivider = ref(false) // intermezzo "Bustina X completata" tra i gruppi
const packStackRef = ref<{ animateSinglePackExit: (i: number) => void } | null>(null)
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

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
    emit('notif', t('sbusta.no_waifu_in_drop'), C.err)
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
  setTimeout(() => { indiceRivelato.value = 0 }, 1500)
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
  }, 1000)
}

// Apri singolo pacchetto
// Collezione base: se non è ancora caricata (es. account appena creato)
// usa una collezione vuota. saveCollezione usa merge:true, quindi le nuove
// carte vengono aggiunte senza cancellare eventuali dati esistenti.
function collezioneBase(): any {
  return props.collezione ?? { waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {} }
}

async function apri(tipoPacchetto: string) {
  const uid = authStore.user?.uid
  if (!uid) { emit('notif', t('sbusta.no_pack_available'), C.err); return }
  const nuova = JSON.parse(JSON.stringify(collezioneBase()))
  let carte
  try {
    carte = await _generaEAggiorna(tipoPacchetto, nuova)
  } catch (e: any) {
    console.error('apri: errore generazione', e)
    emit('notif', '❌ ' + (e?.message ?? 'Errore apertura pacchetto'), C.err)
    return
  }
  if (!carte) return            // _generaEAggiorna ha già notificato (es. catalogo vuoto)
  if (carte.length === 0) { emit('notif', t('sbusta.no_waifu_in_drop'), C.err); return }

  const gp = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value = carte
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  stato.value = 'reveal'

  // Preload immediato: le immagini arrivano durante l'animazione del pack (≥1.3s)
  preloadCarteImages([carte])

  // Tracking missioni giornaliere
  missionsStore.trackAction('open_pack', 1)
  const hasLegendary = carte.some((c: any) => c.tipo === 'waifu' && c.data?.rarita === 'leggendario')
  if (hasLegendary) missionsStore.trackAction('legendary', 1)

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

// Costruisce la sequenza di tipi da aprire attraversando TUTTI i tipi disponibili
// (priorità omaggio → benvenuto → sfida), fino a `max` pacchetti totali.
function sequenzaMista(max: number): string[] {
  const seq: string[] = []
  let o = nOmag.value, b = nBenv.value, s = nSfid.value
  while (seq.length < max && (o > 0 || b > 0 || s > 0)) {
    if (o > 0) { seq.push('omaggio'); o-- }
    else if (b > 0) { seq.push('benvenuto'); b-- }
    else { seq.push('sfida'); s-- }
  }
  return seq
}

// Apre una sequenza di pacchetti (tipi anche misti): genera le carte, avvia il
// reveal e decrementa i contatori PER TIPO. È il cuore condiviso degli "apri N".
async function apriMultiSequenza(seq: string[]) {
  const uid = authStore.user?.uid
  if (!uid) { emit('notif', t('sbusta.no_pack_available'), C.err); return }
  if (seq.length < 1) { emit('notif', t('sbusta.no_pack_available'), C.err); return }

  const nuova = JSON.parse(JSON.stringify(collezioneBase()))
  const tuttiIPacchetti: any[][] = []
  const aperti: Record<string, number> = { omaggio: 0, benvenuto: 0, sfida: 0 }
  for (const tipo of seq) {
    const carte = await _generaEAggiorna(tipo, nuova)
    if (!carte) break
    tuttiIPacchetti.push(carte)
    aperti[tipo] = (aperti[tipo] ?? 0) + 1
  }
  if (tuttiIPacchetti.length === 0) return

  multiPackCarte.value = tuttiIPacchetti
  multiPackIndice.value = 0

  // Preload di TUTTE le immagini dei pack (fino a 10×5=50 carte)
  preloadCarteImages(tuttiIPacchetti)

  carteRivelate.value = []
  indiceRivelato.value = -1
  bustaAperta.value = false
  bustaInAnimazione.value = false
  multiPhase.value = 'stack'
  multiExitedCount.value = 0
  stato.value = 'reveal_multi'

  // Tracking missioni giornaliere
  missionsStore.trackAction('open_pack', tuttiIPacchetti.length)
  const legCount = tuttiIPacchetti.flat().filter((c: any) => c.tipo === 'waifu' && c.data?.rarita === 'leggendario').length
  if (legCount > 0) missionsStore.trackAction('legendary', legCount)

  emit('updateCollezione', nuova)
  try {
    await saveCollezione(uid, nuova as any)
    // Decremento per-tipo (scala solo i tipi effettivamente aperti)
    const patch: Record<string, number> = {}
    if (aperti.benvenuto) patch.pacchettiBenvenuto = Number(props.profilo?.pacchettiBenvenuto ?? 0) - aperti.benvenuto
    if (aperti.omaggio)   patch.pacchettiOmaggio   = Number(props.profilo?.pacchettiOmaggio ?? 0) - aperti.omaggio
    if (aperti.sfida)     patch.pacchettiSfida     = Number(props.profilo?.pacchettiSfida ?? 0) - aperti.sfida
    if (Object.keys(patch).length) {
      emit('updateProfilo', patch)
      await updateUserProfile(uid, patch)
    }
  } catch (e) {
    console.error('apriMultiSequenza: errore salvataggio', e)
  }

  tuttiIPacchetti.forEach(carte => {
    const carteClean = JSON.parse(JSON.stringify(carte))
    createPackSnapshot(uid, carteClean).catch((e: any) => console.error('createPackSnapshot:', e))
  })
}

// "APRI 10" principale: apre 10 pacchetti attraverso tutti i tipi disponibili.
function apriMulti10() {
  apriMultiSequenza(sequenzaMista(10))
}

// Popup "×10 APRI TUTTI": apre fino a 10 pacchetti di UN tipo specifico.
function apriMulti(tipoPacchetto: string) {
  const disp = tipoPacchetto === 'benvenuto'
    ? nBenv.value
    : tipoPacchetto === 'omaggio' ? nOmag.value : nSfid.value
  apriMultiSequenza(Array(Math.min(10, disp)).fill(tipoPacchetto))
}

// Lo stack resta FERMO finché l'utente non tocca → poi uscita una alla volta
async function onStackTap() {
  if (multiPhase.value !== 'stack') return
  multiPhase.value = 'exiting'
  const n = multiPackCarte.value.length
  for (let i = 0; i < n; i++) {
    if (multiPhase.value !== 'exiting') return  // utente ha premuto SALTA
    multiExitedCount.value = i + 1
    packStackRef.value?.animateSinglePackExit(i)  // fire-and-forget → effetto cascata
    await delay(120)                              // cascata un po' più lenta tra una e l'altra
  }
  if (multiPhase.value !== 'exiting') return
  await delay(1500)                                // attende la fine dell'ultima animazione
  startMultiReveal()
}

function skipMultiOpening() {
  if (multiPhase.value === 'revealing') return
  startMultiReveal()
}

// ── FASE 2: reveal carte a gruppi di 5 ──
function startMultiReveal() {
  multiPhase.value = 'revealing'
  multiPackIndice.value = 0
  const carte = multiPackCarte.value[0]
  isGodPackAperto.value = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  carteRivelate.value = carte
  bustaAperta.value = true
  indiceRivelato.value = -1
  revealTilt.value = { x: 0, y: 0 }
  setTimeout(() => { indiceRivelato.value = 0 }, 300)
}

// Tap durante la fase 2: avanza carta → poi gruppo successivo → poi riepilogo
async function avanzaMultiCarta() {
  if (transizioneCarta.value || multiPackDivider.value) return
  // Carta successiva nello stesso gruppo
  if (indiceRivelato.value < carteRivelate.value.length - 1) {
    transizioneCarta.value = true
    setTimeout(() => {
      indiceRivelato.value++
      revealTilt.value = { x: 0, y: 0 }
      transizioneCarta.value = false
    }, 350)
    return
  }
  // Gruppo finito → prossima bustina
  if (multiPackIndice.value < multiPackCarte.value.length - 1) {
    multiPackDivider.value = true
    await delay(900)
    multiPackDivider.value = false
    const prossimo = multiPackIndice.value + 1
    const carte = multiPackCarte.value[prossimo]
    isGodPackAperto.value = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
    multiPackIndice.value = prossimo
    carteRivelate.value = carte
    indiceRivelato.value = -1
    revealTilt.value = { x: 0, y: 0 }
    setTimeout(() => { indiceRivelato.value = 0 }, 200)
    return
  }
  // Tutte le 50 carte mostrate → riepilogo (il cui CONTINUA torna alla homepage)
  stato.value = 'summary_multi'
}

// ── SALTA (tieni premuto): scorrimento velocissimo del reveal carte ──
let fastForwardTimer: ReturnType<typeof setInterval> | null = null

function fastForwardAttivo(): boolean {
  // solo mentre le carte escono (bustina già aperta), mai durante "tocca per aprire"
  return bustaAperta.value && (stato.value === 'reveal' || (stato.value === 'reveal_multi' && multiPhase.value === 'revealing'))
}

function avanzaVeloce() {
  // bypassa transizioni/divisori lenti
  transizioneCarta.value = false
  multiPackDivider.value = false

  // PACCHETTO SINGOLO (APRI 1)
  if (stato.value === 'reveal') {
    if (indiceRivelato.value < carteRivelate.value.length - 1) { indiceRivelato.value++; return }
    stopFastForward()
    stato.value = 'summary'
    return
  }

  // APRI 10 — fase reveal
  if (stato.value === 'reveal_multi' && multiPhase.value === 'revealing') {
    // carta successiva nello stesso gruppo
    if (indiceRivelato.value < carteRivelate.value.length - 1) { indiceRivelato.value++; return }
    // gruppo finito → prossima bustina (istantaneo, niente intermezzo)
    if (multiPackIndice.value < multiPackCarte.value.length - 1) {
      const prossimo = multiPackIndice.value + 1
      const carte = multiPackCarte.value[prossimo]
      isGodPackAperto.value = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
      multiPackIndice.value = prossimo
      carteRivelate.value = carte
      indiceRivelato.value = 0
      return
    }
    // tutte mostrate → riepilogo
    stopFastForward()
    stato.value = 'summary_multi'
    return
  }

  stopFastForward()
}

function startFastForward() {
  if (fastForwardTimer || !fastForwardAttivo()) return
  avanzaVeloce()                                    // primo step immediato
  fastForwardTimer = setInterval(avanzaVeloce, 280) // più veloce del normale, senza esagerare
}
function stopFastForward() {
  if (fastForwardTimer) { clearInterval(fastForwardTimer); fastForwardTimer = null }
}

// Fine sbusto: chiude l'overlay e torna alla HOMEPAGE (non alla selezione espansione)
function concludiSbusto() {
  stopFastForward()
  carteRivelate.value = []
  multiPackCarte.value = []
  multiPackIndice.value = 0
  bustaAperta.value = false
  stato.value = 'idle'
  emit('indietro')
}

// Solo flusso APRI 1: il multi usa avanzaMultiCarta
function mostraRiepilogo() {
  stato.value = 'summary'
}

// Tap nell'area reveal: instrada al flusso giusto (singolo vs multi)
function onRevealTap() {
  if (stato.value === 'reveal_multi') { avanzaMultiCarta(); return }
  if (indiceRivelato.value < carteRivelate.value.length - 1) avanzaCartaManuale()
  else mostraRiepilogo()
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
    else emit('notif', t('sbusta.packs_added', { n: pAgg }), '#ff8c00')
  } catch (e: any) {
    emit('notif', e?.data?.error || t('sbusta.buy_error'), C.err)
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
  stopFastForward()
})
watch(() => (props.profilo as any)?.ultimaRicaricaPacchetti, aggiornaCountdown)

// ── 3D tilt carta rivelata ───────────────────────────────────
const revealTilt = ref({ x: 0, y: 0 })
const revealDragging = ref(false)
const revealDragOrigin = ref({ x: 0, y: 0, tx: 0, ty: 0 })

const cartaCorrente = computed(() =>
  indiceRivelato.value >= 0 ? carteRivelate.value[indiceRivelato.value] : null
)

// ── Reveal speciale Leggendario / Immersivo (flip 3D dal retro) ──────
const SPECIAL_RARITIES = ['leggendario', 'immersivo']
function isSpecialRarity(rarita?: string): boolean {
  return !!rarita && SPECIAL_RARITIES.includes(rarita.toLowerCase())
}
const flipPlaying = ref(false)   // animazione flip in corso
const flipPending = ref(false)   // carta speciale: mostra il retro prima di girare

// Quando cambia la carta corrente, se è leggendaria/immersiva avvia il flip dal retro
watch(indiceRivelato, async (idx) => {
  flipPlaying.value = false
  flipPending.value = false
  if (idx < 0) return
  const carta = carteRivelate.value[idx]
  if (carta?.tipo === 'waifu' && isSpecialRarity(carta?.data?.rarita)) {
    flipPending.value = true            // mostra subito il RETRO (niente flash del fronte)
    await nextTick()
    // doppio rAF: garantisce che il retro sia dipinto prima di far partire l'animazione
    requestAnimationFrame(() => requestAnimationFrame(() => { flipPlaying.value = true }))
  }
})

function onFlipEnd(e: AnimationEvent) {
  // Ignora gli animationend che bubblano dai figli (shimmer/foil/glow di CartaWaifu):
  // reagisci SOLO all'animazione di flip che gira sul body stesso.
  if (e.target !== e.currentTarget) return
  flipPlaying.value = false
  flipPending.value = false           // torna al fronte (rotateY 0)
}

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

  <!-- LOADING — full-screen fixed, usato quando SbustaTab è overlay -->
  <AppLoading v-if="dropsLoading" fullscreen />

  <!-- ══════════════════════════════════════════════════════════
    REVEAL VIEW — Pokémon Pocket Style Pack Opening & 3D Stack
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'reveal' || stato === 'reveal_multi'"
    style="position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; overflow: hidden; background:var(--theme-bg); perspective: 1200px;">

    <!-- SALTA (tieni premuto) → scorrimento veloce delle carte (singolo e x10) -->
    <button
      v-if="bustaAperta && (stato === 'reveal' || (stato === 'reveal_multi' && multiPhase === 'revealing'))"
      class="reveal-ff-btn"
      @pointerdown.stop.prevent="startFastForward"
      @pointerup.stop="stopFastForward"
      @pointerleave.stop="stopFastForward"
      @pointercancel.stop="stopFastForward"
      @click.stop
    >
      <FastForward class="reveal-ff-btn__chev" :size="16" :stroke-width="2.5" fill="currentColor" />
      <span class="reveal-ff-btn__label">{{ $t('sbusta.skip') }}</span>
    </button>

    <!-- 1a. APRI 10 — stack FERMO → (tap) → uscita una alla volta -->
    <div v-if="stato === 'reveal_multi' && (multiPhase === 'stack' || multiPhase === 'exiting')"
      class="pack-stack-scene"
      :style="{
        position:'absolute', inset:0, zIndex:250,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:`radial-gradient(circle at center, ${dropColore}28 0%, transparent 100%)`,
        overflow:'hidden',
      }"
      @click="onStackTap">
      <!-- Contatore / titolo -->
      <p class="pack-stack-label">
        <template v-if="multiPhase === 'exiting'">{{ $t('sbusta.exit_count', { n: multiExitedCount, total: multiPackCarte.length }) }}</template>
        <template v-else>{{ $t('sbusta.n_packs_label', { n: multiPackCarte.length }) }}</template>
      </p>

      <div class="pack-stack-container">
        <!-- Stack 3D: 1 sola scena Three.js con N cloni del modello .glb -->
        <PackStackGL
          ref="packStackRef"
          :count="multiPackCarte.length"
          :color="dropColore"
          :texture-url="dropAttivo?.asset_bustina ?? null"
          :width="300" :height="420"
        />
        <!-- Riflesso finto sotto il canvas -->
        <div v-if="multiPhase === 'stack'" class="pack-stack-reflection-fake" />
      </div>

      <!-- Hint pulsante (solo a stack fermo) -->
      <p v-if="multiPhase === 'stack'" class="pack-stack-hint">{{ $t('sbusta.tap_to_open') }}</p>

      <!-- SALTA → solo durante l'uscita -->
      <button v-if="multiPhase === 'exiting'" class="multi-skip-btn" @click.stop="skipMultiOpening">{{ $t('sbusta.skip_exit') }}</button>
    </div>

    <!-- 1b. APRI 1 — FASE DI SBUSTO INTERATTIVA (tap per aprire) -->
    <div v-else-if="!bustaAperta"
      :style="{
        position:'absolute', inset:0, zIndex:250,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:`radial-gradient(circle at center, ${dropColore}28 0%, transparent 100%)`,
        cursor:'pointer',
      }"
      @click="eseguiTaglioBustina">
      <div style="text-align: center; margin-bottom: 32px; padding: 0 30px; animation: pulseSoft 2s infinite;">
        <p :style="{ fontFamily: FF.label, fontSize: '15px', color: 'var(--theme-text-2)', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700 }">
          {{ $t('sbusta.tap_to_open') }}
        </p>
      </div>

      <!-- Corpo del Pacchetto 3D — colore dell'espansione selezionata, più grande -->
      <div :class="['booster-pack-wrapper', { 'rip-animation': bustaInAnimazione }]"
        style="position: relative; display: inline-block;">
        <BustinaGLB
          :texture-url="dropAttivo?.asset_bustina ?? null"
          :color="dropColore"
          :model-url="dropAttivo?.asset_glb ?? null"
          :ripping="bustaInAnimazione"
          :width="280" :height="460"
        />
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
          <template v-if="stato === 'reveal_multi'">{{ $t('sbusta.card_progress_multi', { pack: multiPackIndice + 1, n: Math.max(1, indiceRivelato + 1), total: carteRivelate.length }) }}</template>
          <template v-else>{{ $t('sbusta.card_progress', { n: Math.max(1, indiceRivelato + 1), total: carteRivelate.length }) }}</template>
        </div>
      </div>

      <!-- Area Centrale di Gioco delle Carte -->
      <div
        style="position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; z-index: 5;"
        @click="onRevealTap">

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
            <!-- Flip reveal: retro → 2 giravolte + zoom → fronte (solo Leggendario/Immersivo) -->
            <div class="reveal-flip" :class="{ 'reveal-flip--playing': flipPlaying }">
              <div
                class="reveal-flip__body"
                :style="(flipPending && !flipPlaying) ? { transform: 'rotateY(180deg)' } : undefined"
                @animationend="onFlipEnd"
              >
                <!-- FRONTE: la carta vera -->
                <div class="reveal-flip__face reveal-flip__face--front">
                  <CartaWaifu v-if="cartaCorrente.tipo === 'waifu'" :waifu="cartaCorrente.data" dimensione="normale" tipo="auto" />
                  <div v-else-if="cartaCorrente.tipo === 'mossa'" style="width:220px;">
                    <MoveCard :move="(cartaCorrente.data as any)" :owned="true" />
                  </div>
                </div>
                <!-- RETRO: back_card.png -->
                <div class="reveal-flip__face reveal-flip__face--back">
                  <img src="~/assets/images/back_card.png" alt="" class="reveal-flip__back-img" draggable="false" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feedback UI (fuori dall'overflow:hidden) -->
        <div v-if="levelUpDisponibile && indiceRivelato >= 0"
          style="margin-top:14px;padding:8px 22px;border-radius:999px;background:#ffffff;border:1.5px solid rgba(89,224,163,0.5);font-family:var(--ff-label);font-size:14px;font-weight:800;color:#16a34a;letter-spacing:0.14em;text-transform:uppercase;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,0.15);">
          ⚡ Aumento di livello disponibile
        </div>
        <div v-if="indiceRivelato >= carteRivelate.length - 1"
          style="margin-top:18px;font-family:var(--ff-label);font-size:11px;letter-spacing:0.22em;color:var(--theme-text-3);text-transform:uppercase;animation:pulseSoft 1.6s ease-in-out infinite;pointer-events:none;">
          <template v-if="stato === 'reveal_multi' && multiPackIndice < multiPackCarte.length - 1">{{ $t('sbusta.tap_next_pack') }}</template>
          <template v-else>{{ $t('sbusta.tap_for_summary') }}</template>
        </div>
      </div>

      <!-- Intermezzo tra bustine (APRI 10): "Bustina X completata" -->
      <Transition name="fade">
        <div v-if="multiPackDivider" class="multi-pack-divider">
          <span class="multi-pack-divider__done">{{ $t('sbusta.pack_divider_done', { n: multiPackIndice + 1 }) }}</span>
          <span class="multi-pack-divider__next">{{ $t('sbusta.pack_divider_next', { n: multiPackIndice + 2 }) }}</span>
        </div>
      </Transition>
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
        <BtnDecorato variant="secondary" size="md" @click="rivediVideoSbusto">{{ $t('sbusta.rewatch') }}</BtnDecorato>
        <BtnDecorato variant="danger" size="md" @click="chiudiVideoSbusto">{{ $t('sbusta.close') }}</BtnDecorato>
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
            <img v-if="cardImg(carta)"
              :src="cardImg(carta)" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
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
            <img v-if="cardImg(carta)"
              :src="cardImg(carta)" :alt="carta.data?.nome"
              style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
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
      <button @click="concludiSbusto"
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
              <img v-if="cardImg(carta)"
                :src="cardImg(carta)" :alt="carta.data?.nome"
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
              <img v-if="cardImg(carta)"
                :src="cardImg(carta)" :alt="carta.data?.nome"
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
      <button @click="concludiSbusto"
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
              :model-url="d.asset_glb ?? null"
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
              }">{{ $t('sbusta.open_1_main') }}</button>

            <!-- APRI 10 — abilitato solo con almeno 10 pacchetti totali -->
            <button
              @click="totalePacchetti >= 10 && apriMulti10()"
              :disabled="totalePacchetti < 10"
              :style="{
                flex:1, padding:'15px 8px', borderRadius:'999px', border:'none',
                cursor: totalePacchetti >= 10 ? 'pointer' : 'not-allowed',
                background: totalePacchetti >= 10 ? `linear-gradient(135deg,${C.violet},#6938e8)` : 'rgba(255,255,255,0.06)',
                boxShadow: totalePacchetti >= 10 ? `0 6px 28px ${C.violet}55` : 'none',
                fontFamily: FF.display, fontSize:'14px', fontWeight:800,
                color: totalePacchetti >= 10 ? '#fff' : 'var(--theme-text-3)',
                letterSpacing:'0.08em', textTransform:'uppercase',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: totalePacchetti >= 10 ? 1 : 0.4, transition:'opacity 0.2s',
              }">{{ $t('sbusta.open_10_main') }}</button>

          </div>

          <!-- Contatore totale -->
          <div style="text-align:center;padding:2px 0;">
            <template v-if="totalePacchetti > 0">
              <span :style="{ fontFamily:FF.label, fontSize:'22px', fontWeight:900, color:C.gold }">{{ totalePacchetti }}</span>
              <span :style="{ fontFamily:FF.label, fontSize:'12px', letterSpacing:'0.16em', color:'var(--theme-text-3)', marginLeft:'8px', textTransform:'uppercase' }">{{ $t('sbusta.packs_available_label') }}</span>
            </template>
            <template v-else>
              <span :style="{ fontFamily:FF.label, fontSize:'12px', letterSpacing:'0.16em', color:'var(--theme-text-3)', textTransform:'uppercase' }">{{ $t('sbusta.no_pack_available') }}</span>
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
        {{ $t('sbusta.pack_modal_title', { type: $t('sbusta.pack_' + popupApertura.tipoPacchetto) }) }}
      </div>

      <!-- Quantità -->
      <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:12px;color:rgba(148,192,232,0.75);margin-bottom:26px;letter-spacing:0.04em;">
        {{ $t('sbusta.available_count', { n: contaPackPopup }) }}
      </div>

      <!-- Bottoni -->
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
        <!-- APRI 1 -->
        <button @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apri(t) }"
          :style="{width:'100%',padding:'15px 24px',borderRadius:'999px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',background:popupColor.btn1,border:`1.5px solid ${popupColor.border}`,boxShadow:`0 4px 24px ${popupColor.glow},inset 0 1px 0 rgba(255,255,255,0.1)`,fontFamily:`var(--ff-display,'Unbounded',sans-serif)`,fontSize:'15px',fontWeight:800,color:popupColor.btn1txt,letterSpacing:'0.12em',textTransform:'uppercase'}">
          <span style="font-size:18px;line-height:1;">🃏</span> {{ $t('sbusta.open_1_main') }}
        </button>
        <!-- APRI 10 -->
        <button v-if="contaPackPopup >= 2"
          @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apriMulti(t) }"
          :style="{width:'100%',padding:'15px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',background:popupColor.btn2bg,border:`1.5px solid ${popupColor.btn2border}`,boxShadow:`0 4px 18px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.04)`,fontFamily:`var(--ff-display,'Unbounded',sans-serif)`,fontSize:'13px',fontWeight:800,color:popupColor.btn2txt,letterSpacing:'0.08em',textTransform:'uppercase',borderRadius:'8px',clipPath:'polygon(14px 0%,calc(100% - 14px) 0%,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0% calc(100% - 14px),0% 14px)'}">
          <span style="font-size:18px;line-height:1;">🃏</span> {{ $t('sbusta.open_all') }}
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
      <div :style="{ fontFamily: FF.label, fontSize: '11px', color: C.sakura, letterSpacing: '0.32em', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 700 }">{{ $t('sbusta.buy_pack_title') }}</div>
      <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', marginBottom: '18px' }">{{ $t('sbusta.choose_qty') }}</div>
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '16px' }">
        <button @click="acquistaSfidaConKisses(1)" :style="{
          background: `${C.sakura}1f`, border: `1px solid ${C.sakura}66`, borderRadius: '10px', color: C.sakuraL,
          fontFamily: FF.label, fontSize: '10px', fontWeight: 700, padding: '11px 16px', cursor: 'pointer',
          letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }">{{ $t('sbusta.pack_1x', { cost: SFIDA_COSTO_KISSES }) }}</button>
        <button @click="(profilo?.kisses ?? 0) >= SFIDA_COSTO_10 ? acquistaSfidaConKisses(10) : (sfidaConferma = false, sfidaShortage = true)" :style="{
          background: `linear-gradient(135deg, ${C.gold}26, ${C.sakura}1f)`, border: `1px solid ${C.gold}66`,
          borderRadius: '10px', color: C.goldL, fontFamily: FF.label, fontSize: '10px', fontWeight: 700,
          padding: '11px 16px', cursor: 'pointer', letterSpacing: '0.18em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }">{{ $t('sbusta.pack_10x', { cost: SFIDA_COSTO_10 }) }}</button>
      </div>
      <button @click="sfidaConferma = false" :style="{
        background: 'none', border: `1px solid ${C.inkLine}`, borderRadius: '9px', color: 'rgba(241,235,255,0.5)',
        fontFamily: FF.label, fontSize: '10px', padding: '10px 16px', cursor: 'pointer', width: '100%',
        letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
      }">{{ $t('sbusta.cancel') }}</button>
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
/* Fade-in morbido quando la bustina riappare tra un'apertura e l'altra (APRI 10) */
.booster-pack-wrapper {
  transition: opacity 0.35s ease;
}
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

/* ══════════════════════════════════════════════════════════════════
   REVEAL SPECIALE LEGGENDARIO / IMMERSIVO — flip 3D dal retro
   ══════════════════════════════════════════════════════════════════ */
.reveal-flip {
  position: relative;
  display: inline-block;
}

/* Bagliore dorato durante l'animazione */
.reveal-flip--playing::before {
  content: '';
  position: absolute;
  inset: -24px;
  border-radius: 24px;
  background: radial-gradient(ellipse, rgba(255,200,50,0.45) 0%, transparent 70%);
  animation: legendaryGlow 3.2s ease-in-out forwards;
  pointer-events: none;
  z-index: -1;
}

.reveal-flip__body {
  position: relative;
  display: inline-block;
  transform-style: preserve-3d;
  /* stato base: fronte visibile */
  transform: rotateY(0deg) scale(1);
}

.reveal-flip--playing .reveal-flip__body {
  /* Più lenta e fluida: 3.2s con easing morbido in entrata/uscita */
  animation: legendaryReveal 3.2s cubic-bezier(0.33, 0, 0.2, 1) forwards;
  filter: drop-shadow(0 20px 40px rgba(255,180,0,0.3));
}

/* Le due facce */
.reveal-flip__face {
  border-radius: 14px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
/* Il fronte è la carta in flusso normale (definisce la dimensione del body) */
.reveal-flip__face--front {
  position: relative;
  z-index: 2;
}
/* Il retro è sovrapposto, ruotato di 180° */
.reveal-flip__face--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  z-index: 1;
  overflow: hidden;
}
.reveal-flip__back-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 14px;
  display: block;
}

/*
  Gradi: 180°=retro (start) → 540°=1 giro (retro) → 900°=2 giri (retro)
  → 720°=fine (720 mod 360 = 0° = fronte). Retro → gira ×2 con zoom → fronte.
*/
@keyframes legendaryReveal {
  /* retro → 2 giravolte fluide con zoom graduale → fronte. Più step = movimento più smooth */
  0%   { transform: rotateY(180deg) scale(1); }
  20%  { transform: rotateY(450deg) scale(1.12); }
  40%  { transform: rotateY(720deg) scale(1.22); }
  58%  { transform: rotateY(900deg) scale(1.3); }
  78%  { transform: rotateY(900deg) scale(1.3); }  /* pausa in zoom sul fronte */
  100% { transform: rotateY(720deg) scale(1); }    /* zoom-out morbido, fronte */
}

@keyframes legendaryGlow {
  0%   { opacity: 0; transform: scale(0.8); }
  30%  { opacity: 1; transform: scale(1.2); }
  75%  { opacity: 1; transform: scale(1.3); }
  100% { opacity: 0; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-flip--playing .reveal-flip__body {
    animation: legendaryRevealReduced 0.6s ease forwards;
    filter: none;
  }
  @keyframes legendaryRevealReduced {
    0%   { transform: rotateY(180deg) scale(1); }
    100% { transform: rotateY(720deg) scale(1); }
  }
  .reveal-flip--playing::before { display: none; }
}

/* ══════════════════════════════════════════════════════════════════
   APRI 10 — Stack 3D fermo (PackStackGL) → uscita una alla volta
   ══════════════════════════════════════════════════════════════════ */
.pack-stack-scene { cursor: pointer; }
.pack-stack-scene:active { transform: scale(0.99); transition: transform 0.1s; }

.pack-stack-label {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: 3px;
  color: var(--text-secondary);
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 24px;
  font-variant-numeric: tabular-nums;
}

.pack-stack-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: stackEnter 0.5s cubic-bezier(0.25, 0.8, 0.3, 1);
}
@keyframes stackEnter {
  0%   { opacity: 0; transform: scale(0.85) translateY(24px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* Riflesso finto sfumato sotto il canvas dello stack */
.pack-stack-reflection-fake {
  width: 220px;
  height: 70px;
  margin: -10px auto 0;
  background: radial-gradient(ellipse at center top, var(--accent-soft) 0%, transparent 70%);
  filter: blur(10px);
  opacity: 0.45;
  pointer-events: none;
}

/* Hint pulsante "Tocca per aprire" */
.pack-stack-hint {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: 3px;
  color: var(--text-secondary);
  text-transform: uppercase;
  text-align: center;
  margin-top: 24px;
  animation: stackHintPulse 2s ease-in-out infinite;
}
@keyframes stackHintPulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .pack-stack-container { animation-duration: 0.35s; }
  .pack-stack-hint { animation: none; opacity: 0.8; }
}

/* Bottone SALTA */
.multi-skip-btn {
  position: fixed;
  bottom: 40px; right: 24px;
  z-index: 260;
  padding: 10px 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill, 9999px);
  background: var(--surface-glass);
  color: var(--text-secondary);
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 2px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: var(--shadow-float);
  transition: background 0.2s, color 0.2s, transform 0.1s;
}
.multi-skip-btn:hover { background: var(--surface-raised); color: var(--text-primary); }
.multi-skip-btn:active { transform: scale(0.96); }

/* Bottone SALTA tieni-premuto — neumorfico raised (gradient + soft shadow 3D) */
.reveal-ff-btn {
  position: fixed;
  bottom: 30px; right: 20px;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 13px 22px;
  border: 1.5px solid var(--theme-accent);
  border-radius: var(--radius-pill, 9999px);
  background: linear-gradient(145deg, var(--theme-surface), var(--theme-surface-2));
  color: var(--theme-accent);
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  /* effetto 3D neumorfico (come i filtri della collezione) */
  box-shadow: var(--shadow-neu-out);
  touch-action: none;            /* evita scroll/gesture mentre tieni premuto */
  user-select: none;
  transition: box-shadow 0.1s ease, background 0.1s ease;
}
.reveal-ff-btn:active {
  /* pressione: si "affossa" (shadow inset) */
  background: linear-gradient(145deg, var(--theme-surface-2), var(--theme-surface));
  box-shadow: var(--shadow-neu-in);
}
.reveal-ff-btn__chev {
  flex-shrink: 0;
  animation: ff-chev 0.7s linear infinite;
}
.reveal-ff-btn:active .reveal-ff-btn__chev { animation-duration: 0.28s; }
@keyframes ff-chev { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }

/* Intermezzo "Bustina X completata" */
.multi-pack-divider {
  position: absolute;
  inset: 0;
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: radial-gradient(circle at center, var(--bg-base) 35%, transparent 100%);
  pointer-events: none;
}
.multi-pack-divider__done {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 900;
  font-size: 20px;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}
.multi-pack-divider__next {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
