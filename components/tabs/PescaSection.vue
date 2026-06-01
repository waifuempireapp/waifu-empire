<!-- ============================================================
  Sezione Pesca Misteriosa (Waifu Drop): mostra i pack del feed,
  gestisce la selezione alla cieca, il pagamento in Kisses e
  l'animazione di rivelazione della carta ottenuta.
  Porta PescaMisteriosaFeed.jsx + PescaMisteriosaOverlay.jsx
  ============================================================ -->
<script setup lang="ts">
import type { ProfiloUtente, Collezione } from '~/types/game'
import { useAuthStore } from '~/stores/auth'

// ── Costo fisso per pescare un pack ──────────────────────────
const KISSES_COST = 10

// ── Props ─────────────────────────────────────────────────────
const props = defineProps<{
  profilo:      ProfiloUtente | null
  collezione:   Collezione | null
  initialPacks: unknown[] | null
}>()

// ── Emits ─────────────────────────────────────────────────────
const emit = defineEmits<{
  indietro:         []
  updateProfilo:    [p: unknown]
  updateCollezione: [c: unknown]
}>()

// ── Auth ──────────────────────────────────────────────────────
const authStore = useAuthStore()

// ── Tipo minimo di un pack snapshot nel feed ──────────────────
interface CartaPack {
  id:       string
  tipo?:    string
  rarita?:  string
  nome?:    string
  immagine?:string
  hot?:     boolean
}

interface Pack {
  id:            string
  ownerName?:    string
  ownerUid?:     string
  cards?:        CartaPack[]
  alreadyFished?:boolean
  hasHot?:       boolean
  createdAt?:    string | number
  expiresAt?:    string | number
  dropName?:     string
  isGhost?:      boolean
}

// ── Stato del feed ────────────────────────────────────────────
const packs    = ref<Pack[]>((props.initialPacks as Pack[]) ?? [])
const loading  = ref(props.initialPacks === null)
const error    = ref<string | null>(null)

// ── Stato della selezione alla cieca ─────────────────────────
// Pack correntemente aperto per la selezione
const selectedPack      = ref<Pack | null>(null)
// Ordine mescolato degli indici carte (Fisher-Yates)
const shuffledOrder     = ref<number[]>([])
// Indice UI (0-4) della carta selezionata dall'utente
const selectedCardIndex = ref<number | null>(null)
// In attesa della risposta API
const busy              = ref(false)

// ── Stato post-pesca ─────────────────────────────────────────
// Risultato da passare all'animazione di rivelazione
const risultato = ref<{
  allCards:    CartaPack[]
  chosenIndex: number
  isNewArr:    boolean[]
} | null>(null)

// Salva l'id del pack pescato per aggiornare lo stato locale
const lastFishedId     = ref<string | null>(null)
const lastFishedIsGhost = ref<boolean>(false)

// ── Notifica toast ────────────────────────────────────────────
const notif = ref<{ testo: string; colore: string } | null>(null)
let notifTimer: ReturnType<typeof setTimeout> | null = null

function mostraNotif(testo: string, colore = '#ff4d9e') {
  notif.value = { testo, colore }
  if (notifTimer) clearTimeout(notifTimer)
  notifTimer = setTimeout(() => { notif.value = null }, 2500)
}

// ── Modale Kisses insufficienti ───────────────────────────────
const kissesShortage = ref<{ pendingPack: Pack } | null>(null)

// ── Kisses attuali dal profilo ────────────────────────────────
const kissesAttuali = computed(() => props.profilo?.kisses ?? 0)

// ── Fisher-Yates shuffle ──────────────────────────────────────
function fisherYates(arr: number[]): number[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Carica il feed dal server ─────────────────────────────────
async function caricaFeed() {
  if (!authStore.user) return
  loading.value = true
  error.value   = null
  try {
    const token = await authStore.user.getIdToken()
    const data = await $fetch<{ packs: Pack[] }>('/api/pesca/feed', {
      headers: { Authorization: `Bearer ${token}` },
    })
    packs.value = data.packs ?? []
  } catch (e: any) {
    error.value = e?.message ?? 'Errore caricamento feed'
  } finally {
    loading.value = false
  }
}

// Carica solo se non sono stati passati initialPacks
onMounted(() => {
  if (props.initialPacks === null) caricaFeed()
})

// ── Fase della selezione alla cieca: reveal → shuffle → pick ──
// 'reveal' = mostra carte originali, 'shuffle' = animazione mescola, 'pick' = scegli
const pickPhase = ref<'reveal' | 'shuffle' | 'pick'>('reveal')
// Posizioni casuali delle carte durante lo shuffle (translateX,translateY,rotate)
const shufflePositions = ref<{ x: number; y: number; r: number; z?: number; s?: number }[]>([])
let shuffleInterval: ReturnType<typeof setInterval> | null = null

function randomShufflePositions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    x: (Math.random() - 0.5) * 200,  // wider spread
    y: (Math.random() - 0.5) * 120,
    r: (Math.random() - 0.5) * 45,
    z: Math.floor(Math.random() * n), // z-index variation for overlap
    s: 0.85 + Math.random() * 0.25,   // scale variation
  }))
}

// ── Apre il modale selezione alla cieca ───────────────────────
function aprePack(pack: Pack) {
  const n = (pack.cards ?? []).length
  shuffledOrder.value     = fisherYates(Array.from({ length: n }, (_, i) => i))
  selectedPack.value      = pack
  selectedCardIndex.value = null
  pickPhase.value         = 'reveal'

  // Sequenza shuffle stile Pokémon TCG: fan-out → rientro → fan-out → rientro → pick
  const PKM_POSITIONS = [
    // Spread 1: fan-out (sx, destra, alto, basso, centro-fuori)
    [
      { x: -80, y: -30, r: -18, s: 0.9, z: 3 },
      { x:  80, y: -30, r:  18, s: 0.9, z: 4 },
      { x: -60, y:  50, r: -12, s: 0.92, z: 2 },
      { x:   0, y:  70, r:   0, s: 0.9, z: 1 },
      { x:  60, y:  50, r:  12, s: 0.92, z: 5 },
    ],
    // Centro (torna)
    Array.from({ length: n }, () => ({ x: 0, y: 0, r: 0, s: 1, z: 1 })),
    // Spread 2 (diverso): incrocio
    [
      { x:  70, y: -40, r:  22, s: 0.88, z: 5 },
      { x: -70, y:  40, r: -20, s: 0.88, z: 2 },
      { x:  40, y:  60, r:  10, s: 0.93, z: 3 },
      { x: -40, y: -60, r: -10, s: 0.93, z: 1 },
      { x:   0, y: -20, r:  -5, s: 0.95, z: 4 },
    ],
    // Centro finale (torna)
    Array.from({ length: n }, () => ({ x: 0, y: 0, r: 0, s: 1, z: 1 })),
  ]

  setTimeout(() => {
    pickPhase.value = 'shuffle'
    let step = 0
    shufflePositions.value = PKM_POSITIONS[0].slice(0, n) as any
    shuffleInterval = setInterval(() => {
      step++
      if (step < PKM_POSITIONS.length) {
        shufflePositions.value = PKM_POSITIONS[step].slice(0, n) as any
      } else {
        clearInterval(shuffleInterval!)
        shuffleInterval = null
        setTimeout(() => {
          pickPhase.value = 'pick'
          shuffledOrder.value = fisherYates(Array.from({ length: n }, (_, i) => i))
        }, 300)
      }
    }, 450)
  }, 1200)
}

// Helper per gli stili di ogni carta nel blind pick
function cardStyle(uiIdx: number) {
  const pos = shufflePositions.value[uiIdx]
  const isSel = selectedCardIndex.value === uiIdx && pickPhase.value === 'pick'
  return {
    aspectRatio: '2/3',
    borderRadius: '13px',
    overflow: 'hidden',
    position: 'relative',
    cursor: pickPhase.value === 'pick' ? 'pointer' : 'default',
    border: isSel ? '2px solid #ff4d9e' : '1.5px solid rgba(245,166,35,0.28)',
    boxShadow: isSel
      ? '0 0 24px rgba(255,77,158,0.55), 0 0 0 1px rgba(255,77,158,0.2) inset'
      : '0 5px 16px rgba(0,0,0,0.5)',
    background: 'linear-gradient(145deg,#160830,#0d0520)',
    zIndex: pickPhase.value === 'shuffle' ? (pos?.z ?? 1) : isSel ? 5 : 1,
    transform: pickPhase.value === 'shuffle' && pos
      ? `translate(${pos.x}px, ${pos.y}px) rotate(${pos.r}deg) scale(${pos.s ?? 1})`
      : isSel ? 'scale(1.06)' : 'scale(1)',
    transition: pickPhase.value === 'shuffle'
      ? 'transform 0.42s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s'
      : 'all 0.22s ease',
  }
}

// Cleanup timer se il modale viene chiuso
watch(selectedPack, (val) => {
  if (!val && shuffleInterval) {
    clearInterval(shuffleInterval)
    shuffleInterval = null
  }
})

// ── Conferma la scelta e chiama l'API di pesca ────────────────
async function confermaScelta() {
  if (selectedCardIndex.value === null || !selectedPack.value || busy.value) return
  busy.value = true
  try {
    const realIndex = shuffledOrder.value[selectedCardIndex.value]
    const token     = await authStore.user?.getIdToken()
    const body      = { snapshotId: selectedPack.value.id, chosenCardIndex: realIndex }
    await $fetch('/api/pesca/fish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    })

    // Salva info per l'aggiornamento locale post-rivelazione
    lastFishedId.value      = selectedPack.value.id
    lastFishedIsGhost.value = selectedPack.value.isGhost ?? false

    // Prepara le carte nell'ordine mescolato mostrato all'utente
    const shuffledCards = shuffledOrder.value.map(i => (selectedPack.value!.cards ?? [])[i])
    const isNewArr = shuffledCards.map((c: CartaPack) => {
      if (!props.collezione) return false
      if (c.tipo === 'waifu')  return !props.collezione.waifu?.[c.id]
      if (c.tipo === 'outfit') return !props.collezione.outfit?.[c.id]
      if (c.tipo === 'posa')   return !props.collezione.pose?.[c.id]
      return false
    })

    risultato.value = {
      allCards:    shuffledCards,
      chosenIndex: selectedCardIndex.value,
      isNewArr,
    }

    // Chiude il modale di selezione
    selectedPack.value      = null
    selectedCardIndex.value = null
    shuffledOrder.value     = []

    // Notifica parent che sono stati spesi kisses
    emit('updateProfilo', { ...(props.profilo ?? {}), kisses: kissesAttuali.value - KISSES_COST })
  } catch (e: any) {
    const status = (e as any)?.statusCode ?? (e as any)?.status
    if (status === 409) {
      // Pack già pescato da un'altra sessione — chiudi modale e aggiorna feed
      mostraNotif('Già pescata da qualcun altro!', '#f59e0b')
      selectedPack.value = null
      selectedCardIndex.value = null
      await caricaFeed()
    } else {
      mostraNotif((e as any)?.data?.error ?? (e as any)?.message ?? 'Errore pesca', '#ff4d4d')
    }
  } finally {
    busy.value = false
  }
}

// ── Chiamata al completamento dell'animazione ─────────────────
async function onRivelazioneFine() {
  risultato.value = null
  const fishedId = lastFishedId.value
  if (fishedId) {
    // Aggiorna stato locale: marca il pack come pescato
    packs.value = packs.value.map(p =>
      p.id === fishedId ? { ...p, alreadyFished: true } : p
    )
    lastFishedId.value = null
  }
  mostraNotif('Carta aggiunta alla collezione!', '#00e676')
  // Chiede al parent di ricaricare la collezione
  emit('updateCollezione', null)
}

// ── Gestione click su un pack del feed ───────────────────────
function onClickPesca(pack: Pack) {
  if (pack.alreadyFished) return
  if (pack.hasHot && !props.profilo?.hardPass) return // bloccato senza Hard Pass
  if (kissesAttuali.value < KISSES_COST) {
    kissesShortage.value = { pendingPack: pack }
  } else {
    aprePack(pack)
  }
}

// ── Callback modale Kisses: acquisto avvenuto ────────────────
function onKissesSuccess(newKisses: number) {
  const pending = kissesShortage.value?.pendingPack
  kissesShortage.value = null
  emit('updateProfilo', { ...(props.profilo ?? {}), kisses: newKisses })
  if (pending) {
    setTimeout(() => aprePack(pending), 200)
  }
}

onUnmounted(() => {
  if (notifTimer) clearTimeout(notifTimer)
})
</script>

<template>
  <!-- ── Contenitore outer a tutto schermo (stile Overlay) ── -->
  <div
    style="position:fixed;inset:0;z-index:9999;
           background:rgba(6,3,15,0.98);backdrop-filter:blur(20px);
           overflow-y:auto;display:flex;flex-direction:column"
  >
    <!-- Header sticky — stile screenshot Waifu Drop -->
    <div style="
      position:sticky; top:0; z-index:100;
      background:rgba(6,3,15,0.97); backdrop-filter:blur(20px);
      border-bottom:1px solid rgba(255,255,255,0.05);
      padding:14px 18px;
      display:flex; align-items:center; justify-content:space-between;
    ">
      <!-- Sinistra: back + titolo -->
      <div style="display:flex;align-items:center;gap:14px;">
        <button
          style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;"
          @click="$emit('indietro')"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M14 5L8 11L14 17" stroke="rgba(255,255,255,0.65)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <!-- Icona cuffie + titolo -->
        <div style="display:flex;align-items:center;gap:8px;">
          <!--<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="#6cf0e0" stroke-width="2" stroke-linecap="round"/> 
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke="#6cf0e0" stroke-width="2"/>
          </svg> -->
          <div>
            <span style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:#fff;letter-spacing:0.02em;">WAIFU </span>
            <span style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:rgb(255, 77, 158);letter-spacing:0.02em;">DROP</span>
          </div>
        </div>
      </div>

      <!-- Destra: GEMME counter -->
      <div style="display:flex;align-items:center;gap:7px;background:rgba(255,80,160,0.1);border:1px solid rgba(255,80,160,0.3);border-radius:999px;padding:6px 14px;">
        <span style="font-size:16px;line-height:1">💎</span>
        <div>
          <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:7px;color:rgba(255,80,160,0.6);letter-spacing:0.2em;text-transform:uppercase;line-height:1;font-weight:700;">GEMME</div>
          <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:14px;font-weight:800;color:#ff4d9e;line-height:1.2;">{{ kissesAttuali }}</div>
        </div>
      </div>
    </div>

    <!-- Corpo principale con larghezza massima -->
    <div style="max-width:480px;margin:0 auto;padding:20px 16px;width:100%;position:relative">

      <!-- Toast notifica -->
      <div
        v-if="notif"
        :style="{
          position:'fixed', top:'16px', left:'50%', transform:'translateX(-50%)',
          background:'rgba(6,3,15,0.97)', backdropFilter:'blur(12px)',
          border:`1px solid ${notif.colore}80`, color:notif.colore,
          padding:'10px 24px', borderRadius:'10px',
          fontFamily:'Orbitron,sans-serif', letterSpacing:'2px', fontSize:'11px', zIndex:500,
        }"
      >{{ notif.testo }}</div>

      <!-- Modale KissesShortageModal — acquisto Kisses mancanti -->
      <KissesShortageModal
        v-if="kissesShortage"
        :missing-kisses="KISSES_COST - kissesAttuali"
        :current-kisses="kissesAttuali"
        @success="onKissesSuccess"
        @cancel="kissesShortage = null"
      />

      <!-- Animazione rivelazione carta pescata -->
      <PescaRevealAnimation
        v-if="risultato"
        :all-cards="risultato.allCards"
        :chosen-index="risultato.chosenIndex"
        :is-new-arr="risultato.isNewArr"
        :on-complete="onRivelazioneFine"
      />

      <!-- Pesca alla cieca — Teleport to body -->
      <Teleport to="body">
      <div
        v-if="selectedPack"
        style="
          position:fixed; inset:0; z-index:99999;
          background:linear-gradient(160deg, #08041a 0%, #0d0520 50%, #07051a 100%);
          display:flex; flex-direction:column; overflow:hidden;
          padding-top:max(16px,env(safe-area-inset-top));
          padding-bottom:max(16px,env(safe-area-inset-bottom));
        "
      >
        <!-- Fase indicator -->
        <div style="flex-shrink:0; text-align:center; padding:8px 20px 4px;">
          <div :style="{
            fontFamily: 'var(--ff-label,\'Saira Condensed\',sans-serif)',
            fontSize: '9px', letterSpacing: '0.3em',
            color: pickPhase === 'pick' ? 'rgba(255,77,158,0.7)' : 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase', fontWeight: 700, transition: 'color 0.3s',
          }">
            {{ pickPhase === 'reveal' ? '✦ Ecco le tue carte ✦' : pickPhase === 'shuffle' ? '⟳ Mescolando...' : 'Scegli una carta' }}
          </div>
        </div>

        <!-- Area carte: 3-column grid, tutte stesse dimensioni (1fr) -->
        <div style="flex:1; display:flex; align-items:center; justify-content:center; min-height:0; padding:4px 14px; overflow:visible; position:relative;">
          <div style="width:100%; max-width:360px; display:flex; flex-direction:column; gap:10px;">

            <!-- Riga 1: 2 carte centrate con flex (stessa larghezza delle 3 sotto) -->
            <div style="display:flex; justify-content:center; gap:10px;">
              <!-- Carta 0 -->
              <div
                :style="{ ...cardStyle(0), width: 'calc((100% - 20px) / 3)', flexShrink: '0' }"
                @click="pickPhase === 'pick' && (selectedCardIndex = (selectedCardIndex === 0 ? null : 0))"
              >
                <template v-if="pickPhase === 'reveal'"><img v-if="selectedPack.cards?.[0]?.immagine" :src="selectedPack.cards[0].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/><div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div></template>
                <template v-else><div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(245,166,35,0.03) 8px,rgba(245,166,35,0.03) 9px);"/><div style="width:100%;height:100%;display:grid;place-items:center;position:relative;"><img src="~/assets/images/New_Logo.png" alt="" :style="{width:'50%',opacity:pickPhase==='pick'&&selectedCardIndex===0?1:0.68,filter:pickPhase==='pick'&&selectedCardIndex===0?'drop-shadow(0 0 14px rgba(255,77,158,0.8))':'none',transition:'all 0.2s'}"/><div v-if="pickPhase==='pick'&&selectedCardIndex===0" style="position:absolute;bottom:8px;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">SCELTA</div></div></template>
              </div>
              <!-- Carta 1 -->
              <div
                :style="{ ...cardStyle(1), width: 'calc((100% - 20px) / 3)', flexShrink: '0' }"
                @click="pickPhase === 'pick' && (selectedCardIndex = (selectedCardIndex === 1 ? null : 1))"
              >
                <template v-if="pickPhase === 'reveal'"><img v-if="selectedPack.cards?.[1]?.immagine" :src="selectedPack.cards[1].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/><div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div></template>
                <template v-else><div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(245,166,35,0.03) 8px,rgba(245,166,35,0.03) 9px);"/><div style="width:100%;height:100%;display:grid;place-items:center;position:relative;"><img src="~/assets/images/New_Logo.png" alt="" :style="{width:'50%',opacity:pickPhase==='pick'&&selectedCardIndex===1?1:0.68,filter:pickPhase==='pick'&&selectedCardIndex===1?'drop-shadow(0 0 14px rgba(255,77,158,0.8))':'none',transition:'all 0.2s'}"/><div v-if="pickPhase==='pick'&&selectedCardIndex===1" style="position:absolute;bottom:8px;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">SCELTA</div></div></template>
              </div>
            </div>

            <!-- Riga 2: 3 carte (stessa larghezza) -->
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
              <div v-for="uiIdx in [2,3,4]" :key="uiIdx"
                :style="cardStyle(uiIdx)"
                @click="pickPhase === 'pick' && (selectedCardIndex = (selectedCardIndex === uiIdx ? null : uiIdx))"
              >
                <template v-if="pickPhase === 'reveal'"><img v-if="selectedPack.cards?.[uiIdx]?.immagine" :src="selectedPack.cards[uiIdx].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/><div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div></template>
                <template v-else><div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(245,166,35,0.03) 8px,rgba(245,166,35,0.03) 9px);"/><div style="width:100%;height:100%;display:grid;place-items:center;position:relative;"><img src="~/assets/images/New_Logo.png" alt="" :style="{width:'48%',opacity:pickPhase==='pick'&&selectedCardIndex===uiIdx?1:0.65,filter:pickPhase==='pick'&&selectedCardIndex===uiIdx?'drop-shadow(0 0 12px rgba(255,77,158,0.8))':'none',transition:'all 0.2s'}"/><div v-if="pickPhase==='pick'&&selectedCardIndex===uiIdx" style="position:absolute;bottom:6px;font-size:7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:1.5px;color:#ff4d9e;font-weight:800;">SCELTA</div></div></template>
              </div>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div style="flex-shrink:0; padding:10px 20px 0; display:flex; gap:10px; justify-content:center;">
          <button
            style="background:none;border:1px solid rgba(255,255,255,0.15);border-radius:999px;color:rgba(238,232,220,0.45);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;padding:13px 28px;cursor:pointer;letter-spacing:0.12em;"
            @click="selectedPack = null; selectedCardIndex = null; shuffledOrder = []; pickPhase = 'reveal'; if(shuffleInterval){clearInterval(shuffleInterval);shuffleInterval=null}"
          >ANNULLA</button>
          <button
            v-if="pickPhase === 'pick'"
            :disabled="selectedCardIndex === null || busy"
            :style="{
              background: selectedCardIndex !== null ? 'linear-gradient(135deg,rgba(255,77,158,0.25),rgba(255,77,158,0.12))' : 'rgba(255,255,255,0.03)',
              border: `2px solid ${selectedCardIndex !== null ? 'rgba(255,77,158,0.6)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius:'999px', padding:'13px 28px',
              color: selectedCardIndex !== null ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
              fontFamily: 'var(--ff-label,\'Saira Condensed\',sans-serif)', fontSize:'13px', fontWeight:700,
              letterSpacing:'0.14em', cursor: selectedCardIndex !== null && !busy ? 'pointer' : 'not-allowed',
              display:'flex', alignItems:'center', gap:'8px', transition:'all 0.2s',
              boxShadow: selectedCardIndex !== null ? '0 0 20px rgba(255,77,158,0.3)' : 'none',
            }"
            @click="confermaScelta"
          >
            <KissesIcon :size="16" />
            {{ busy ? 'PESCA IN CORSO…' : `PESCA (${KISSES_COST})` }}
          </button>
          <div v-else style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;color:rgba(255,255,255,0.22);letter-spacing:0.2em;display:flex;align-items:center;min-height:44px;">
            {{ pickPhase === 'shuffle' ? '⟳ mescolando...' : '' }}
          </div>
        </div>
      </div>
      </Teleport>

      <!-- Stato caricamento -->
      <div
        v-if="loading"
        style="text-align:center;padding:24px;
               color:rgba(238,232,220,0.35);font-family:'Orbitron',sans-serif;
               font-size:9px;letter-spacing:2px"
      >CARICAMENTO…</div>

      <!-- Messaggio errore -->
      <div
        v-if="error"
        style="text-align:center;padding:16px;color:#ff4d4d;
               font-family:'Orbitron',sans-serif;font-size:10px"
      >{{ error }}</div>

      <!-- Lista pack del feed -->
      <div style="display:flex;flex-direction:column;gap:28px;padding-top:20px;overflow:visible;">
        <div
          v-for="(pack, idx) in packs"
          :key="pack.id"
          style="position:relative;"
        >
          <!-- Badge NUOVA/HOT: fuori dalla card, z-index altissimo -->
          <div
            v-if="(pack.createdAt && (Date.now() - new Date(pack.createdAt).getTime() < 3*60*60*1000) || pack.hasHot) && !pack.alreadyFished"
            style="position:absolute;top:-16px;right:16px;z-index:10;display:flex;gap:6px;pointer-events:none;"
          >
            <div
              v-if="pack.createdAt && Date.now() - new Date(pack.createdAt).getTime() < 3*60*60*1000"
              style="background:linear-gradient(135deg,#00c853,#00e676);border:2px solid rgba(255,255,255,0.3);border-radius:999px;padding:5px 16px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;color:#000;font-weight:900;letter-spacing:0.12em;box-shadow:0 4px 16px rgba(0,230,118,0.5);"
            >NUOVA</div>
            <div
              v-if="pack.hasHot"
              style="background:linear-gradient(135deg,#ff6500,#ff9000);border:2px solid rgba(255,255,255,0.3);border-radius:999px;padding:5px 16px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;color:#fff;font-weight:900;letter-spacing:0.1em;box-shadow:0 4px 16px rgba(255,100,0,0.5);"
            >HOT 🔥</div>
          </div>

          <PescaPackCard
            :pack="pack"
            :kisses-cost="KISSES_COST"
            :user-kisses="kissesAttuali"
            :collezione="collezione"
            :has-hard-pass="profilo?.hardPass === true"
            @pesca="onClickPesca"
          />
        </div>
      </div>

    </div>
  </div>
</template>
