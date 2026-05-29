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

// ── Apre il modale selezione alla cieca ───────────────────────
function aprePack(pack: Pack) {
  const n = (pack.cards ?? []).length
  shuffledOrder.value     = fisherYates(Array.from({ length: n }, (_, i) => i))
  selectedPack.value      = pack
  selectedCardIndex.value = null
}

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
    mostraNotif(e?.message ?? 'Errore pesca', '#ff4d4d')
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
    style="position:fixed;inset:0;z-index:300;
           background:rgba(6,3,15,0.98);backdrop-filter:blur(20px);
           overflow-y:auto;display:flex;flex-direction:column"
  >
    <!-- Header sticky con pulsante INDIETRO e contatore Kisses -->
    <div
      style="position:sticky;top:0;z-index:10;
             background:rgba(6,3,15,0.97);backdrop-filter:blur(20px);
             border-bottom:1px solid rgba(255,77,158,0.12);
             padding:12px 18px;display:flex;align-items:center;justify-content:space-between"
    >
      <div style="display:flex;align-items:center;gap:12px">
        <button
          style="background:none;border:1px solid rgba(255,77,158,0.3);border-radius:7px;
                 color:#ff4d9e;font-family:'Orbitron',sans-serif;font-size:9px;
                 padding:6px 12px;cursor:pointer"
          @click="$emit('indietro')"
        >← INDIETRO</button>
        <div style="font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;color:#ff4d9e;letter-spacing:3px">
          🎣 WAIFU DROP
        </div>
      </div>
      <!-- Saldo Kisses in tempo reale -->
      <div style="display:flex;align-items:center;gap:4px">
        <KissesIcon :size="16" />
        <span style="font-family:'Orbitron',sans-serif;font-size:14px;font-weight:800;color:#ff4d9e">
          {{ kissesAttuali }}
        </span>
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

      <!-- Modale selezione alla cieca — full-viewport -->
      <div
        v-if="selectedPack"
        style="position:fixed;inset:0;z-index:400;
               background:rgba(6,3,15,0.97);backdrop-filter:blur(20px);
               display:flex;flex-direction:column;
               padding-top:max(16px,env(safe-area-inset-top));
               padding-bottom:max(20px,env(safe-area-inset-bottom));
               padding-inline:16px"
      >
        <!-- Intestazione selezione cieca -->
        <div style="text-align:center;flex-shrink:0;padding-bottom:12px">
          <div style="font-family:'Orbitron',sans-serif;font-size:12px;letter-spacing:3px;color:#ff4d9e;margin-bottom:4px">
            PESCA ALLA CIECA
          </div>
          <div style="font-size:11px;color:rgba(238,232,220,0.45);font-family:'Fredoka',sans-serif">
            Di {{ selectedPack.ownerName }} — Scegli una carta senza sapere cosa c'è dentro
          </div>
        </div>

        <!-- Griglia carte coperte 3+2 -->
        <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:0">
          <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
            <!-- Riga 1: 3 carte -->
            <div style="display:flex;gap:10px">
              <div
                v-for="uiIdx in [0,1,2]"
                :key="uiIdx"
                :style="{
                  width:'72px', height:'100px', borderRadius:'8px', flexShrink:0,
                  background:'linear-gradient(145deg,#120825,#0d0618)',
                  border:`2px solid ${selectedCardIndex === uiIdx ? '#ff4d9e' : 'rgba(245,166,35,0.35)'}`,
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column', gap:'4px',
                  boxShadow: selectedCardIndex === uiIdx
                    ? '0 0 20px rgba(255,77,158,0.6),0 0 8px rgba(255,77,158,0.3)'
                    : '0 2px 12px rgba(0,0,0,0.5)',
                  transform: selectedCardIndex === uiIdx ? 'scale(1.1) translateY(-6px)' : 'scale(1)',
                  transition:'all 0.2s cubic-bezier(.4,0,.2,1)',
                  position:'relative', overflow:'hidden', userSelect:'none',
                }"
                @click="selectedCardIndex = (selectedCardIndex === uiIdx ? null : uiIdx)"
              >
                <div :style="{
                  position:'absolute', inset:'4px',
                  border:`1px solid ${selectedCardIndex === uiIdx ? 'rgba(255,77,158,0.4)' : 'rgba(245,166,35,0.15)'}`,
                  borderRadius:'5px', transition:'border-color 0.2s'
                }" />
                <div style="position:absolute;inset:0;
                            background-image:repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(245,166,35,0.03) 6px,rgba(245,166,35,0.03) 7px)" />
                <span :style="{
                  fontSize:'26px',
                  color: selectedCardIndex === uiIdx ? '#ff4d9e' : 'rgba(245,166,35,0.55)',
                  filter: selectedCardIndex === uiIdx ? 'drop-shadow(0 0 10px rgba(255,77,158,0.9))' : 'none',
                  transition:'all 0.2s', zIndex:1
                }">♛</span>
                <div
                  v-if="selectedCardIndex === uiIdx"
                  style="font-size:7px;font-family:'Orbitron',sans-serif;letter-spacing:1px;color:#ff4d9e;z-index:1"
                >SCELTA</div>
              </div>
            </div>

            <!-- Riga 2: 2 carte centrate -->
            <div style="display:flex;gap:10px">
              <div
                v-for="uiIdx in [3,4]"
                :key="uiIdx"
                :style="{
                  width:'72px', height:'100px', borderRadius:'8px', flexShrink:0,
                  background:'linear-gradient(145deg,#120825,#0d0618)',
                  border:`2px solid ${selectedCardIndex === uiIdx ? '#ff4d9e' : 'rgba(245,166,35,0.35)'}`,
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column', gap:'4px',
                  boxShadow: selectedCardIndex === uiIdx
                    ? '0 0 20px rgba(255,77,158,0.6),0 0 8px rgba(255,77,158,0.3)'
                    : '0 2px 12px rgba(0,0,0,0.5)',
                  transform: selectedCardIndex === uiIdx ? 'scale(1.1) translateY(-6px)' : 'scale(1)',
                  transition:'all 0.2s cubic-bezier(.4,0,.2,1)',
                  position:'relative', overflow:'hidden', userSelect:'none',
                }"
                @click="selectedCardIndex = (selectedCardIndex === uiIdx ? null : uiIdx)"
              >
                <div :style="{
                  position:'absolute', inset:'4px',
                  border:`1px solid ${selectedCardIndex === uiIdx ? 'rgba(255,77,158,0.4)' : 'rgba(245,166,35,0.15)'}`,
                  borderRadius:'5px', transition:'border-color 0.2s'
                }" />
                <div style="position:absolute;inset:0;
                            background-image:repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(245,166,35,0.03) 6px,rgba(245,166,35,0.03) 7px)" />
                <span :style="{
                  fontSize:'26px',
                  color: selectedCardIndex === uiIdx ? '#ff4d9e' : 'rgba(245,166,35,0.55)',
                  filter: selectedCardIndex === uiIdx ? 'drop-shadow(0 0 10px rgba(255,77,158,0.9))' : 'none',
                  transition:'all 0.2s', zIndex:1
                }">♛</span>
                <div
                  v-if="selectedCardIndex === uiIdx"
                  style="font-size:7px;font-family:'Orbitron',sans-serif;letter-spacing:1px;color:#ff4d9e;z-index:1"
                >SCELTA</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer fisso: conferma / annulla -->
        <div style="flex-shrink:0;padding-top:12px">
          <div
            v-if="selectedCardIndex !== null"
            style="font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:2px;
                   color:#ff4d9e;opacity:0.8;text-align:center;margin-bottom:10px"
          >
            Carta {{ selectedCardIndex + 1 }} selezionata
          </div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button
              style="background:none;border:1px solid rgba(255,255,255,0.15);border-radius:8px;
                     color:rgba(238,232,220,0.45);font-family:'Orbitron',sans-serif;
                     font-size:9px;padding:12px 18px;cursor:pointer"
              @click="selectedPack = null; selectedCardIndex = null; shuffledOrder = []"
            >ANNULLA</button>
            <button
              :disabled="selectedCardIndex === null || busy"
              :style="{
                background:   selectedCardIndex !== null ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
                border:       `1px solid ${selectedCardIndex !== null ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '24px',
                color:        selectedCardIndex !== null ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
                fontFamily:   'Orbitron,sans-serif', fontSize:'11px', letterSpacing:'1px',
                padding:      '13px 22px',
                cursor:       (selectedCardIndex !== null && !busy) ? 'pointer' : 'not-allowed',
                display:      'flex', alignItems:'center', gap:'6px', transition:'all 0.2s',
              }"
              @click="confermaScelta"
            >
              <KissesIcon :size="14" />
              {{ busy ? 'PESCA IN CORSO…' : `PESCA (${KISSES_COST} Kisses)` }}
            </button>
          </div>
        </div>
      </div>

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
      <div style="display:flex;flex-direction:column;gap:12px">
        <PescaPackCard
          v-for="pack in packs"
          :key="pack.id"
          :pack="pack"
          :kisses-cost="KISSES_COST"
          :user-kisses="kissesAttuali"
          :collezione="collezione"
          :on-pesca="onClickPesca"
        />
      </div>

    </div>
  </div>
</template>
