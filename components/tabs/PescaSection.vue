<script setup lang="ts">
import type { ProfiloUtente, Collezione } from '~/types/game'
import type { CSSProperties } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useMissionsStore } from '~/stores/missions'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// ── Costo fisso per pescare un pack ──────────────────────────
const KISSES_COST = 10

// ── Props ─────────────────────────────────────────────────────
const props = defineProps<{
  profilo: ProfiloUtente | null
  collezione: Collezione | null
  initialPacks: unknown[] | null
}>()

// ── Emits ─────────────────────────────────────────────────────
const emit = defineEmits<{
  indietro: []
  updateProfilo: [p: unknown]
  updateCollezione: [c: unknown]
}>()

// ── Auth ──────────────────────────────────────────────────────
const authStore     = useAuthStore()
const missionsStore = useMissionsStore()
const { t } = useI18n()

// ── Tipo minimo di un pack snapshot nel feed ──────────────────
interface CartaPack {
  id: string
  tipo?: string
  rarita?: string
  nome?: string
  immagine?: string
  hot?: boolean
}

interface Pack {
  id: string
  ownerName?: string
  ownerUid?: string
  cards?: CartaPack[]
  alreadyFished?: boolean
  hasHot?: boolean
  createdAt?: string | number
  expiresAt?: string | number
  dropName?: string
  isGhost?: boolean
}

// ── Stato del feed ────────────────────────────────────────────
const packs = ref<Pack[]>((props.initialPacks as Pack[]) ?? [])
const loading = ref(props.initialPacks === null)
const error = ref<string | null>(null)

// ── Stato della selezione alla cieca ─────────────────────────
const selectedPack = ref<Pack | null>(null)
const shuffledOrder = ref<number[]>([])
const selectedCardIndex = ref<number | null>(null)
const busy = ref(false)

// ── Stato post-pesca ─────────────────────────────────────────
const risultato = ref<{
  allCards: CartaPack[]
  chosenIndex: number
  isNewArr: boolean[]
} | null>(null)

const lastFishedId = ref<string | null>(null)
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
  immaginiCaricate.value = false
  error.value = null
  try {
    const token = await authStore.user.getIdToken()
    const data = await ($fetch('/api/pesca/feed', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { packs: Pack[] }
    packs.value = data.packs ?? []
    await preloadAllImages(packs.value)
  } catch (e: any) {
    error.value = e?.message ?? t('pesca.feed_error')
    immaginiCaricate.value = true  // sblocca anche su errore
  } finally {
    loading.value = false
  }
}

// Precarica tutte le thumbnail dei pack e aspetta che siano nella cache HTTP.
// Timeout 6s: non blocca l'UI se la rete è lenta.
const immaginiCaricate = ref(false)

async function preloadAllImages(packList: typeof packs.value): Promise<void> {
  if (typeof window === 'undefined') { immaginiCaricate.value = true; return }
  const { ikUrl: iku } = await import('~/utils/imagekitUrl')
  const urls = packList
    .flatMap(p => (p.cards ?? []).map(c => c.immagine ? (iku(c.immagine, 'thumbnail') || null) : null))
    .filter((u): u is string => !!u)

  await Promise.race([
    Promise.all(urls.map(url => new Promise<void>(resolve => {
      const img = new Image()
      img.onload = img.onerror = () => resolve()
      img.src = url
    }))),
    new Promise<void>(resolve => setTimeout(resolve, 6000)),
  ])
  immaginiCaricate.value = true
}

onMounted(async () => {
  if (props.initialPacks === null) {
    await caricaFeed()
  } else {
    packs.value = props.initialPacks as Pack[]
    await preloadAllImages(packs.value)
  }
})

// Aggiorna il feed (es. pull-to-refresh): ricarica e ripreloada
async function ricaricaFeed() {
  immaginiCaricate.value = false
  await caricaFeed()
}

// ── Coreografia Shuffle 3D Stile Pokémon Pocket ────────────────
const pickPhase = ref<'reveal' | 'shuffle' | 'pick' | 'revealing' | 'revealed'>('reveal')
// Carte rivelate in place (sostituisce PescaRevealAnimation)
const inPlaceCards   = ref<CartaPack[]>([])          // 5 carte nell'ordine mostrato
const inPlaceNew     = ref<boolean[]>([])              // badge NEW
const inPlaceFlipped = ref<Set<number>>(new Set())    // indici già girati
const inPlaceChosen  = ref<number | null>(null)        // quale ha scelto l'utente
const shuffleStep = ref(0)
const shuffleTimeouts = ref<ReturnType<typeof setTimeout>[]>([])

// Vettori di offset calcolati al millimetro per far convergere le carte sopra Card 3 (Bottom Centro)
const centerOffsets = [
  { x: 62, y: 180, r: 5, z: 3 },  // Card 0 (Top SX)
  { x: -62, y: 180, r: -4, z: 4 },  // Card 1 (Top DX)
  { x: 123, y: 0, r: -8, z: 2 },  // Card 2 (Bottom SX)
  { x: 0, y: 0, r: 1, z: 5 },  // Card 3 (Bottom Centro - Fulcro del Mazzo)
  { x: -123, y: 0, r: 7, z: 1 }   // Card 4 (Bottom DX)
]

function pulisciTimeoutShuffle() {
  shuffleTimeouts.value.forEach(clearTimeout)
  shuffleTimeouts.value = []
}

// Watcher di sicurezza: pulisce istantaneamente i timer attivi in caso di chiusura imprevista o annullamento
watch(selectedPack, (val) => {
  if (!val) {
    pulisciTimeoutShuffle()
    shuffleStep.value = 0
  }
  // Blocca scroll body quando il blind pick è aperto
  if (typeof document !== 'undefined') {
    document.body.style.overflow = val ? 'hidden' : ''
    document.body.style.touchAction = val ? 'none' : ''
  }
})

watch(() => risultato.value, (val) => {
  // Blocca scroll body anche durante la reveal animation
  if (typeof document !== 'undefined') {
    document.body.style.overflow = val ? 'hidden' : ''
    document.body.style.touchAction = val ? 'none' : ''
  }
})

// ── Apre il modale selezione alla cieca con coreografia TCG ───────────────────────
function aprePack(pack: Pack) {
  const n = (pack.cards ?? []).length
  shuffledOrder.value = fisherYates(Array.from({ length: n }, (_, i) => i))
  selectedPack.value = pack
  selectedCardIndex.value = null
  pickPhase.value = 'reveal'

  pulisciTimeoutShuffle()

  // Sequenza di shuffle cinematica a tempo continuo (Hardware Accelerated)
  const t1 = setTimeout(() => {
    pickPhase.value = 'shuffle'
    shuffleStep.value = 1 // Fase 1: Chiusura magnetica nel mazzo unico

    const t2 = setTimeout(() => {
      shuffleStep.value = 2 // Fase 2: Rotazione 3D sull'asse Y (Pack Flip tridimensionale)

      const t3 = setTimeout(() => {
        shuffleStep.value = 3 // Fase 3: Taglio/Esplosione asimmetrica delle carte nello spazio

        const t4 = setTimeout(() => {
          shuffleStep.value = 4 // Fase 4: Avvitamento finale prima del posizionamento sul tavolo

          const t5 = setTimeout(() => {
            pickPhase.value = 'pick'
            shuffleStep.value = 0
            shuffledOrder.value = fisherYates(Array.from({ length: n }, (_, i) => i))
          }, 450)
          shuffleTimeouts.value.push(t5)
        }, 400)
        shuffleTimeouts.value.push(t4)
      }, 450)
      shuffleTimeouts.value.push(t3)
    }, 500)
    shuffleTimeouts.value.push(t2)
  }, 1200)
  shuffleTimeouts.value.push(t1)
}

// Helper stile carta — gestisce tutte le fasi incluso in-place reveal
function cardStyle(uiIdx: number): CSSProperties {
  const isSel = selectedCardIndex.value === uiIdx && pickPhase.value === 'pick'
  const isChosen = inPlaceChosen.value === uiIdx
  const isFlipped = inPlaceFlipped.value.has(uiIdx)
  let transform = 'scale(1)'
  let zIndex = 1
  let transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'

  // Fase revealing/revealed: flip 3D
  if (pickPhase.value === 'revealing' || pickPhase.value === 'revealed') {
    if (isChosen && isFlipped) {
      zIndex = 10
      transform = 'scale(1.08) translateY(-10px)'
      transition = 'transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275)'
    } else if (isFlipped) {
      zIndex = 3
      transform = 'scale(1)'
      transition = 'transform 0.45s ease'
    } else {
      zIndex = 1
      transform = 'scale(0.97)'
      transition = 'transform 0.3s ease'
    }
    return {
      aspectRatio: '2/3', borderRadius: '13px', overflow: 'visible',
      position: 'relative', cursor: 'default',
      border: isChosen && isFlipped
        ? '2px solid #ff4d9e'
        : isFlipped ? '1.5px solid rgba(245,166,35,0.45)' : '1.5px solid rgba(245,166,35,0.15)',
      boxShadow: isChosen && isFlipped
        ? '0 0 32px rgba(255,77,158,0.7), 0 0 0 1px rgba(255,77,158,0.3) inset'
        : isFlipped ? '0 6px 20px rgba(0,0,0,0.5)' : '0 3px 10px rgba(0,0,0,0.4)',
      background: 'var(--theme-bg-secondary)',
      zIndex, transform, transition,
    }
  }

  if (pickPhase.value === 'shuffle') {
    const base = centerOffsets[uiIdx] || { x: 0, y: 0, r: 0, z: 1 }

    if (shuffleStep.value === 1) {
      // Le carte lasciano la griglia e volano fluide verso il mazzo centrale sovrapponendosi in modo impreciso
      transform = `perspective(1000px) translate3d(${base.x}px, ${base.y}px, 0) rotate(${base.r}deg) scale(0.95)`
      zIndex = base.z
      transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s'
    } else if (shuffleStep.value === 2) {
      // Il blocco mazzo ruota vistosamente in 3D nello spazio prospettico simulando il retro delle carte
      transform = `perspective(1000px) translate3d(${base.x}px, ${base.y}px, 50px) rotateY(180deg) rotateX(12deg) scale(1.05)`
      zIndex = base.z
      transition = 'transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)'
    } else if (shuffleStep.value === 3) {
      // Esplosione a incrocio: le carte schizzano in fuori invertendo la profondità visiva per ingannare l'occhio
      const burstVectors = [
        { x: base.x - 75, y: base.y - 40, r: -20, z: 2 },
        { x: base.x + 75, y: base.y - 40, r: 20, z: 5 },
        { x: base.x - 115, y: base.y + 20, r: -12, z: 1 },
        { x: base.x, y: base.y + 60, r: 8, z: 4 },
        { x: base.x + 115, y: base.y + 20, r: 12, z: 3 }
      ]
      const b = burstVectors[uiIdx]
      transform = `perspective(1000px) translate3d(${b.x}px, ${b.y}px, 10px) rotate(${b.r}deg) scale(0.98)`
      zIndex = b.z
      transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    } else if (shuffleStep.value === 4) {
      // Chiusura lampo sul mazzo con avvitamento completo prima della distribuzione finale
      transform = `perspective(1000px) translate3d(${base.x}px, ${base.y}px, 0) rotate(360deg) scale(1)`
      zIndex = base.z
      transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  } else if (pickPhase.value === 'pick') {
    // Fase di scelta: rimbalzo morbido stile Pokémon Pocket quando l'utente seleziona o deseleziona la carta
    zIndex = isSel ? 10 : 2
    transform = isSel ? 'scale(1.08) translateY(-14px)' : 'scale(1)'
    transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  }

  return {
    aspectRatio: '2/3',
    borderRadius: '13px',
    overflow: pickPhase.value === 'reveal' ? 'hidden' : 'visible',
    position: 'relative',
    cursor: pickPhase.value === 'pick' ? 'pointer' : 'default',
    border: isSel ? '2px solid #ff4d9e' : '1.5px solid rgba(245,166,35,0.28)',
    boxShadow: isSel
      ? '0 0 28px rgba(255,77,158,0.6), 0 0 0 1px rgba(255,77,158,0.25) inset'
      : '0 6px 20px rgba(0,0,0,0.6)',
    background: 'var(--theme-bg-secondary)',
    zIndex,
    transform,
    transition,
  }
}

// ── Conferma la scelta — reveal in place ──────────────────────
async function confermaScelta() {
  if (selectedCardIndex.value === null || !selectedPack.value || busy.value) return
  busy.value = true
  try {
    const realIndex = shuffledOrder.value[selectedCardIndex.value]
    const token = await authStore.user?.getIdToken()
    const body = { snapshotId: selectedPack.value.id, chosenCardIndex: realIndex }
    await $fetch('/api/pesca/fish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    })

    missionsStore.trackAction('mysterious_draw')
    lastFishedId.value = selectedPack.value.id
    lastFishedIsGhost.value = selectedPack.value.isGhost ?? false

    // Prepara carte nell'ordine mostrato all'utente
    const shuffledCards = shuffledOrder.value.map(i => (selectedPack.value!.cards ?? [])[i])
    const isNewArr = shuffledCards.map((card: CartaPack) => {
      if (!props.collezione) return false
      if (card.tipo === 'waifu')  return !props.collezione.waifu?.[card.id]
      if (card.tipo === 'outfit') return !props.collezione.outfit?.[card.id]
      if (card.tipo === 'posa')   return !props.collezione.pose?.[card.id]
      return false
    })

    inPlaceCards.value   = shuffledCards
    inPlaceNew.value     = isNewArr
    inPlaceFlipped.value = new Set()
    inPlaceChosen.value  = selectedCardIndex.value
    pickPhase.value      = 'revealing'

    emit('updateProfilo', { ...(props.profilo ?? {}), kisses: kissesAttuali.value - KISSES_COST })

    // Flip tutte tranne la scelta (ordine: 0,1,2,4 se scelta=3)
    const nonChosen = [0,1,2,3,4].filter(i => i !== selectedCardIndex.value)
    let delay = 0
    for (const idx of nonChosen) {
      delay += 420
      setTimeout(() => {
        inPlaceFlipped.value = new Set([...inPlaceFlipped.value, idx])
      }, delay)
    }
    // Ultima: la carta scelta con effetto speciale
    delay += 600
    setTimeout(() => {
      inPlaceFlipped.value = new Set([...inPlaceFlipped.value, selectedCardIndex.value!])
      setTimeout(() => {
        pickPhase.value = 'revealed'
      }, 800)
    }, delay)

  } catch (e: any) {
    const status = (e as any)?.statusCode ?? (e as any)?.status
    if (status === 409) {
      mostraNotif(t('pesca.already_fished_other'), '#f59e0b')
      selectedPack.value = null
      selectedCardIndex.value = null
      await caricaFeed()
    } else {
      mostraNotif((e as any)?.data?.error ?? (e as any)?.message ?? t('pesca.fish_error'), '#ff4d4d')
    }
  } finally {
    busy.value = false
  }
}

// ── Chiude il blind pick e aggiorna la collezione ─────────────
async function chiudiRiveal() {
  const fishedId = lastFishedId.value
  selectedPack.value      = null
  selectedCardIndex.value = null
  shuffledOrder.value     = []
  pickPhase.value         = 'reveal'
  inPlaceFlipped.value    = new Set()
  inPlaceCards.value      = []
  if (fishedId) {
    packs.value = packs.value.map(p => p.id === fishedId ? { ...p, alreadyFished: true } : p)
    lastFishedId.value = null
  }
  mostraNotif(t('pesca.card_added'), '#00e676')
  emit('updateCollezione', null)
  // Ricarica il feed dal server per avere la lista aggiornata — NON chiude PescaSection
  caricaFeed()
}

// Click su carta durante il pick: seleziona e pesca automaticamente senza bottone
function onPickCard(idx: number) {
  if (pickPhase.value !== 'pick' || busy.value) return
  selectedCardIndex.value = idx
  confermaScelta()
}

async function onRivelazioneFine() {
  risultato.value = null
  const fishedId = lastFishedId.value
  if (fishedId) {
    packs.value = packs.value.map(p =>
      p.id === fishedId ? { ...p, alreadyFished: true } : p
    )
    lastFishedId.value = null
  }
  mostraNotif(t('pesca.card_added'), '#00e676')
  emit('updateCollezione', null)
}

function onClickPesca(pack: Pack) {
  if (pack.alreadyFished) return
  if (pack.hasHot && !props.profilo?.hardPass) return
  if (kissesAttuali.value < KISSES_COST) {
    kissesShortage.value = { pendingPack: pack }
  } else {
    aprePack(pack)
  }
}

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
  pulisciTimeoutShuffle()
  // Ripristina scroll body
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
  }
})
</script>

<template>
  <div style="position:fixed;inset:0;z-index:9999;
           background:var(--theme-bg);backdrop-filter:blur(20px);
           overflow-y:auto;display:flex;flex-direction:column">
    <div style="
      position:sticky; top:0; z-index:100;
      background:var(--theme-surface);backdrop-filter:blur(20px);
      border-bottom:1px solid var(--theme-border);
      padding:14px 18px;
      display:flex; align-items:center; justify-content:space-between;
    ">
      <div style="display:flex;align-items:center;gap:14px;">
        <!-- ← torna indietro solo dalla lista drop, non dalla schermata di picking -->
        <button v-if="!selectedPack" style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;color:var(--theme-text-2);"
          @click="$emit('indietro')">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M14 5L8 11L14 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </button>
        <div style="display:flex;align-items:center;gap:8px;">
          <div>
            <span
              style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:var(--theme-text);letter-spacing:0.02em;">WAIFU
            </span>
            <span
              style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:rgb(255, 77, 158);letter-spacing:0.02em;">{{ $t('pesca.fish_label') }}</span>
          </div>
        </div>
      </div>

      <div
        style="display:flex;align-items:center;gap:7px;background:rgba(255,80,160,0.1);border:1px solid rgba(255,80,160,0.3);border-radius:999px;padding:6px 14px;">
        <span style="font-size:16px;line-height:1">💎</span>
        <div>
          <div
            style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:rgba(255,80,160,0.75);letter-spacing:0.2em;text-transform:uppercase;line-height:1;font-weight:700;">
            GEMME</div>
          <div
            style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:16px;font-weight:800;color:#ff4d9e;line-height:1.2;">
            {{ kissesAttuali }}</div>
        </div>
      </div>
    </div>

    <div style="max-width:480px;margin:0 auto;padding:20px 16px;width:100%;position:relative">

      <div v-if="notif" :style="{
        position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--theme-surface)', backdropFilter: 'blur(12px)',
        border: `1px solid ${notif.colore}80`, color: notif.colore,
        padding: '10px 24px', borderRadius: '10px',
        fontFamily: 'var(--ff-label)', letterSpacing: '2px', fontSize: '11px', zIndex: 500,
      }">{{ notif.testo }}</div>

      <KissesShortageModal v-if="kissesShortage" :missing-kisses="KISSES_COST - kissesAttuali"
        :current-kisses="kissesAttuali" @success="onKissesSuccess" @cancel="kissesShortage = null" />

      <!-- PescaRevealAnimation sostituita da reveal in-place -->

      <Teleport to="body">
        <div v-if="selectedPack" style="
          position:fixed; inset:0; z-index:99999;
          background:var(--theme-bg);
          display:flex; flex-direction:column; overflow:hidden;
          padding-top:max(16px,env(safe-area-inset-top));
          padding-bottom:max(16px,env(safe-area-inset-bottom));
        ">
          <div style="flex-shrink:0; text-align:center; padding:6px 20px 2px; min-height:28px;">
            <div v-if="pickPhase === 'shuffle' || pickPhase === 'pick'" :style="{
              fontFamily: 'var(--ff-label,\'Saira Condensed\',sans-serif)',
              fontSize: '10px', letterSpacing: '0.25em',
              color: pickPhase === 'pick' ? '#ff4d9e' : 'rgba(238,232,220,0.4)',
              textTransform: 'uppercase', fontWeight: 700, transition: 'color 0.3s',
            }">
              {{ pickPhase === 'shuffle' ? $t('pesca.shuffling') : $t('pesca.choose_card') }}
            </div>
          </div>

          <div
            style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:0; padding:4px 14px; overflow:visible; position:relative; perspective:1200px;">
            <div
              style="width:100%; max-width:360px; display:flex; flex-direction:column; gap:10px; transform-style:preserve-3d;">

              <div style="display:flex; justify-content:center; gap:10px; transform-style:preserve-3d;">
                <div
                  :style="{ ...cardStyle(0), width: 'calc((100% - 20px) / 3)', flexShrink: '0' }"
                  @click="onPickCard(0)">
                  <template v-if="pickPhase === 'reveal'">
                    <img v-if="selectedPack.cards?.[0]?.immagine" :src="selectedPack.cards[0].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/>
                    <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                  </template>
                  <!-- CSS 3D flip: back face (default) → front face (quando inPlaceFlipped) -->
                  <template v-else>
                    <div :style="{position:'absolute',inset:0,transformStyle:'preserve-3d',transition:'transform 0.55s cubic-bezier(0.4,0,0.2,1)',transform:(pickPhase==='revealing'||pickPhase==='revealed')&&inPlaceFlipped.has(0)?'rotateY(180deg)':'rotateY(0deg)'}">
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:13px;overflow:hidden;">
                        <img src="~/assets/images/back_card.png" style="width:100%;height:100%;object-fit:cover;display:block;"/>
                        <div v-if="pickPhase==='pick'&&selectedCardIndex===0" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">{{ $t('pesca.chosen') }}</div>
                      </div>
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);border-radius:13px;overflow:hidden;">
                        <img v-if="inPlaceCards[0]?.immagine" :src="inPlaceCards[0].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;"/>
                        <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                        <div v-if="inPlaceNew[0]" style="position:absolute;top:6px;left:6px;z-index:5;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:2px 8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;letter-spacing:0.06em;">{{ $t('pesca.new_badge') }}</div>
                        <div v-if="inPlaceCards[0]?.rarita" style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;font-weight:800;color:#fff;letter-spacing:0.06em;text-transform:capitalize;">{{ inPlaceCards[0].rarita }}</div>
                      </div>
                    </div>
                  </template>
                </div>
                <div
                  :style="{ ...cardStyle(1), width: 'calc((100% - 20px) / 3)', flexShrink: '0' }"
                  @click="onPickCard(1)">
                  <template v-if="pickPhase === 'reveal'">
                    <img v-if="selectedPack.cards?.[1]?.immagine" :src="selectedPack.cards[1].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/>
                    <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                  </template>
                  <!-- CSS 3D flip -->
                  <template v-else>
                    <div :style="{position:'absolute',inset:0,transformStyle:'preserve-3d',transition:'transform 0.55s cubic-bezier(0.4,0,0.2,1)',transform:(pickPhase==='revealing'||pickPhase==='revealed')&&inPlaceFlipped.has(1)?'rotateY(180deg)':'rotateY(0deg)'}">
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:13px;overflow:hidden;">
                        <img src="~/assets/images/back_card.png" style="width:100%;height:100%;object-fit:cover;display:block;"/>
                        <div v-if="pickPhase==='pick'&&selectedCardIndex===1" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">{{ $t('pesca.chosen') }}</div>
                      </div>
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);border-radius:13px;overflow:hidden;">
                        <img v-if="inPlaceCards[1]?.immagine" :src="inPlaceCards[1].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;"/>
                        <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                        <div v-if="inPlaceNew[1]" style="position:absolute;top:6px;left:6px;z-index:5;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:2px 8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;letter-spacing:0.06em;">{{ $t('pesca.new_badge') }}</div>
                        <div v-if="inPlaceCards[1]?.rarita" style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;font-weight:800;color:#fff;letter-spacing:0.06em;text-transform:capitalize;">{{ inPlaceCards[1].rarita }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; transform-style:preserve-3d;">
                  <div :style="cardStyle(2)"
                    @click="onPickCard(2)">
                  <template v-if="pickPhase === 'reveal'">
                    <img v-if="selectedPack.cards?.[2]?.immagine" :src="selectedPack.cards[2].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/>
                    <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                  </template>
                  <!-- CSS 3D flip -->
                  <template v-else>
                    <div :style="{position:'absolute',inset:0,transformStyle:'preserve-3d',transition:'transform 0.55s cubic-bezier(0.4,0,0.2,1)',transform:(pickPhase==='revealing'||pickPhase==='revealed')&&inPlaceFlipped.has(2)?'rotateY(180deg)':'rotateY(0deg)'}">
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:13px;overflow:hidden;">
                        <img src="~/assets/images/back_card.png" style="width:100%;height:100%;object-fit:cover;display:block;"/>
                        <div v-if="pickPhase==='pick'&&selectedCardIndex===2" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">{{ $t('pesca.chosen') }}</div>
                      </div>
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);border-radius:13px;overflow:hidden;">
                        <img v-if="inPlaceCards[2]?.immagine" :src="inPlaceCards[2].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;"/>
                        <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                        <div v-if="inPlaceNew[2]" style="position:absolute;top:6px;left:6px;z-index:5;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:2px 8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;letter-spacing:0.06em;">{{ $t('pesca.new_badge') }}</div>
                        <div v-if="inPlaceCards[2]?.rarita" style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;font-weight:800;color:#fff;letter-spacing:0.06em;text-transform:capitalize;">{{ inPlaceCards[2].rarita }}</div>
                      </div>
                    </div>
                  </template>
                  </div>
                  <div :style="cardStyle(3)"
                    @click="onPickCard(3)">
                  <template v-if="pickPhase === 'reveal'">
                    <img v-if="selectedPack.cards?.[3]?.immagine" :src="selectedPack.cards[3].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/>
                    <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                  </template>
                  <!-- CSS 3D flip -->
                  <template v-else>
                    <div :style="{position:'absolute',inset:0,transformStyle:'preserve-3d',transition:'transform 0.55s cubic-bezier(0.4,0,0.2,1)',transform:(pickPhase==='revealing'||pickPhase==='revealed')&&inPlaceFlipped.has(3)?'rotateY(180deg)':'rotateY(0deg)'}">
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:13px;overflow:hidden;">
                        <img src="~/assets/images/back_card.png" style="width:100%;height:100%;object-fit:cover;display:block;"/>
                        <div v-if="pickPhase==='pick'&&selectedCardIndex===3" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">{{ $t('pesca.chosen') }}</div>
                      </div>
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);border-radius:13px;overflow:hidden;">
                        <img v-if="inPlaceCards[3]?.immagine" :src="inPlaceCards[3].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;"/>
                        <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                        <div v-if="inPlaceNew[3]" style="position:absolute;top:6px;left:6px;z-index:5;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:2px 8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;letter-spacing:0.06em;">{{ $t('pesca.new_badge') }}</div>
                        <div v-if="inPlaceCards[3]?.rarita" style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;font-weight:800;color:#fff;letter-spacing:0.06em;text-transform:capitalize;">{{ inPlaceCards[3].rarita }}</div>
                      </div>
                    </div>
                  </template>
                  </div>
                  <div :style="cardStyle(4)"
                    @click="onPickCard(4)">
                  <template v-if="pickPhase === 'reveal'">
                    <img v-if="selectedPack.cards?.[4]?.immagine" :src="selectedPack.cards[4].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;"/>
                    <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                  </template>
                  <!-- CSS 3D flip -->
                  <template v-else>
                    <div :style="{position:'absolute',inset:0,transformStyle:'preserve-3d',transition:'transform 0.55s cubic-bezier(0.4,0,0.2,1)',transform:(pickPhase==='revealing'||pickPhase==='revealed')&&inPlaceFlipped.has(4)?'rotateY(180deg)':'rotateY(0deg)'}">
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:13px;overflow:hidden;">
                        <img src="~/assets/images/back_card.png" style="width:100%;height:100%;object-fit:cover;display:block;"/>
                        <div v-if="pickPhase==='pick'&&selectedCardIndex===4" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:2px;color:#ff4d9e;font-weight:800;">{{ $t('pesca.chosen') }}</div>
                      </div>
                      <div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);border-radius:13px;overflow:hidden;">
                        <img v-if="inPlaceCards[4]?.immagine" :src="inPlaceCards[4].immagine" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;"/>
                        <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:55%;opacity:0.75;"/></div>
                        <div v-if="inPlaceNew[4]" style="position:absolute;top:6px;left:6px;z-index:5;background:linear-gradient(135deg,#00b4ff,#00e676);border:1.5px solid rgba(255,255,255,0.4);border-radius:999px;padding:2px 8px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;letter-spacing:0.06em;">{{ $t('pesca.new_badge') }}</div>
                        <div v-if="inPlaceCards[4]?.rarita" style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;font-weight:800;color:#fff;letter-spacing:0.06em;text-transform:capitalize;">{{ inPlaceCards[4].rarita }}</div>
                      </div>
                    </div>
                  </template>
                  </div>
              </div>

            </div>

            <!-- CONTINUA — subito sotto le carte, centrato, visibile solo dopo il reveal -->
            <div v-if="pickPhase === 'revealed'" style="display:flex;justify-content:center;margin-top:28px;padding:0 16px;">
              <button
                style="background:#fff;border:2px solid rgba(0,230,118,0.4);border-radius:999px;padding:14px 48px;color:#16a34a;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:15px;font-weight:800;letter-spacing:0.16em;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 16px rgba(0,0,0,0.12);"
                @click="chiudiRiveal">
                CONTINUA →
              </button>
            </div>

            <!-- Indicatore "in corso" durante il revealing -->
            <div v-else-if="pickPhase === 'revealing'" style="display:flex;justify-content:center;margin-top:28px;height:52px;align-items:center;">
              <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:var(--theme-text-3);letter-spacing:0.2em;text-transform:uppercase;">{{ $t('pesca.revealing') }}</span>
            </div>

          </div>
        </div>
      </Teleport>

      <!-- Overlay: copre tutto finché le immagini non sono in cache -->
      <Transition name="pesca-fade">
        <AppLoading v-if="!immaginiCaricate" fullscreen />
      </Transition>

      <div v-if="error" style="text-align:center;padding:16px;color:#ff4d4d;
               font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px">{{ error }}</div>

      <!-- Empty state: nessun pacchetto da pescare -->
      <div v-if="immaginiCaricate && !error && packs.length === 0"
           style="text-align:center;padding:60px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div style="font-size:52px;">🎣</div>
        <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:var(--theme-text);">{{ $t('pesca.no_packs_title') }}</div>
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;color:var(--theme-text-2);max-width:260px;line-height:1.4;">{{ $t('pesca.no_packs_sub') }}</div>
      </div>

      <div v-show="immaginiCaricate && packs.length > 0" style="display:flex;flex-direction:column;gap:28px;padding-top:20px;overflow:visible;">
        <div v-for="(pack, idx) in packs" :key="pack.id" style="position:relative;">
          <div
            v-if="(pack.createdAt && (Date.now() - new Date(pack.createdAt).getTime() < 3 * 60 * 60 * 1000) || pack.hasHot) && !pack.alreadyFished"
            style="position:absolute;top:-16px;right:16px;z-index:10;display:flex;gap:6px;pointer-events:none;">
            <div v-if="pack.createdAt && Date.now() - new Date(pack.createdAt).getTime() < 3 * 60 * 60 * 1000"
              style="background:linear-gradient(135deg,#00c853,#00e676);border:2px solid rgba(255,255,255,0.3);border-radius:999px;padding:5px 16px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;color:#000;font-weight:900;letter-spacing:0.12em;box-shadow:0 4px 16px rgba(0,230,118,0.5);">
              {{ $t('pesca.new_badge') }}</div>
            <div v-if="pack.hasHot"
              style="background:linear-gradient(135deg,#ff6500,#ff9000);border:2px solid rgba(255,255,255,0.3);border-radius:999px;padding:5px 16px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;color:#fff;font-weight:900;letter-spacing:0.1em;box-shadow:0 4px 16px rgba(255,100,0,0.5);">
              {{ $t('pesca.hot_badge') }}</div>
          </div>

          <PescaPackCard :pack="pack" :kisses-cost="KISSES_COST" :user-kisses="kissesAttuali" :collezione="collezione"
            :has-hard-pass="profilo?.hardPass === true" @pesca="onClickPesca" />
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.pesca-fade-leave-active { transition: opacity 0.4s ease; }
.pesca-fade-leave-to     { opacity: 0; }
</style>