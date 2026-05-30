<!-- ============================================================
  Tab Sbusta: apertura pacchetti gacha (omaggio, benvenuto, sfida).
  Gestisce la rivelazione animata delle carte, i drop stagionali,
  i God Pack e l'acquisto bustine con Kisses.
  Equivalente di src/app/gioco/_redesign/Sbusta.jsx
  ============================================================ -->
<script setup lang="ts">
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

// ── Costanti colori e font (replica di _shared.jsx) ──────────
const C = {
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
  inkLine: 'rgba(174,156,255,0.12)',
}
const FF = {
  display: "var(--ff-display,'Unbounded',sans-serif)",
  label:   "var(--ff-label,'Saira Condensed',sans-serif)",
  body:    "var(--ff-body,'DM Sans',sans-serif)",
  mono:    "var(--ff-mono,'JetBrains Mono',monospace)",
}

// ── Props ────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  profilo:     ProfiloUtente | null
  collezione:  Collezione | null
  waifuCat:    WaifuCatalog[]
  mosseCat:    MossaCatalog[]
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
}>()

const authStore = useAuthStore()

// ── Stato principale ─────────────────────────────────────────
const stato           = ref<'idle' | 'reveal' | 'reveal_multi'>('idle')
const carteRivelate   = ref<any[]>([])
const indiceRivelato  = ref(-1)
const dropsAttivi     = ref<any[]>([])
const dropsLoading    = ref(true)
const dropSelId       = ref<string | null>(null)
const isGodPackAperto = ref(false)
const popupApertura   = ref<{ tipoPacchetto: string } | null>(null)
const sfidaConferma   = ref(false)
const sfidaShortage   = ref(false)
const multiPackCarte  = ref<any[][]>([])
const multiPackIndice = ref(0)

// Stato video carta immersiva
const sbusVideoAttivo    = ref(false)
const sbusVideoFinito    = ref(false)
const sbusCartaImmersiva = ref<any>(null)
const sbusVideoRef       = useTemplateRef<HTMLVideoElement>('sbusVideoRef')

// Carica drop attivi all'avvio
onMounted(async () => {
  dropsLoading.value = true
  try {
    const lista = await listDropsAttivi()
    dropsAttivi.value = lista
    if (lista.length > 0) dropSelId.value = lista[0].id
  } catch {
    // ignora — dropsAttivi resta []
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

// ── Colori drop ──────────────────────────────────────────────
const dropColore  = computed(() => dropAttivo.value?.colore  || C.violet)
const dropColore2 = computed(() => dropAttivo.value?.colore2 || C.sakura)

// ── Costi bustina sfida ──────────────────────────────────────
const SFIDA_COSTO_KISSES = 50
const SFIDA_COSTO_10     = 450

// ── Conteggi bustine ─────────────────────────────────────────
const nBenv = computed(() => props.profilo?.pacchettiBenvenuto ?? 0)
const nOmag = computed(() => props.profilo?.pacchettiOmaggio   ?? 0)
const nSfid = computed(() => props.profilo?.pacchettiSfida     ?? 0)

// ── Progressione drop (manga banner) ─────────────────────────
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

  // Segna carte nuove e aggiorna collezione locale
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

// Countdown timer rivelazione
function avviaRivelazione(carte: any[]) {
  carte.forEach((_: any, i: number) => {
    setTimeout(() => { indiceRivelato.value = i }, 500 + i * 700)
  })
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
  carteRivelate.value  = carte
  indiceRivelato.value = -1
  stato.value          = 'reveal'

  emit('updateCollezione', nuova)
  await saveCollezione(uid, nuova as any)

  // Decrementa contatore bustine
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

  createPackSnapshot(uid, carte as any, {
    dropId:   dropAttivo.value?.id   || null,
    dropName: dropAttivo.value?.nome || null,
  }).catch((e: any) => console.error('createPackSnapshot:', e))

  avviaRivelazione(carte)
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

  emit('updateCollezione', nuova)
  await saveCollezione(uid, nuova as any)

  tuttiIPacchetti.forEach(carte =>
    createPackSnapshot(uid, carte as any).catch((e: any) => console.error('createPackSnapshot:', e))
  )

  // Decrementa contatori
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

  multiPackCarte.value  = tuttiIPacchetti
  multiPackIndice.value = 0
  const prime = tuttiIPacchetti[0]
  const gp = prime.length === 5 && prime.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value  = prime
  indiceRivelato.value = -1
  stato.value          = 'reveal_multi'
  avviaRivelazione(prime)
}

// Avanza al pacchetto successivo in modalità multi
function prossimoPackMulti() {
  const prossimo = multiPackIndice.value + 1
  const carte    = multiPackCarte.value[prossimo]
  const gp       = carte.length === 5 && carte.every((c: any) => c.tipo === 'waifu' && c.isGodPack)
  isGodPackAperto.value = gp
  carteRivelate.value  = carte
  indiceRivelato.value = -1
  multiPackIndice.value = prossimo
  avviaRivelazione(carte)
}

// Torna all'idle dopo rivelazione
function tornaIdle() {
  stato.value          = 'idle'
  carteRivelate.value  = []
  multiPackCarte.value = []
  multiPackIndice.value = 0
}

// ── Video carta immersiva ─────────────────────────────────────
function avviaVideoSbusto(carta: any) {
  sbusCartaImmersiva.value = carta
  sbusVideoFinito.value    = false
  sbusVideoAttivo.value    = true
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
  sbusVideoAttivo.value    = false
  sbusVideoFinito.value    = false
  sbusCartaImmersiva.value = null
}

// ── Acquisto bustina sfida con Kisses ─────────────────────────
async function acquistaSfidaConKisses(qty = 1) {
  sfidaConferma.value = false
  const token = await authStore.user?.getIdToken()
  const endpoint = qty === 10 ? '/api/kisses/buy-pack-10' : '/api/kisses/buy-pack'
  try {
    const data = await $fetch<any>(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const spent      = data.kissesCost ?? (qty === 10 ? SFIDA_COSTO_10 : SFIDA_COSTO_KISSES)
    const newKisses  = Math.max(0, (props.profilo?.kisses ?? 0) - spent)
    const pAgg       = data.pacchettiAggiunti ?? qty
    const newSfid    = (props.profilo?.pacchettiSfida ?? 0) + pAgg
    emit('updateProfilo', { kisses: newKisses, pacchettiSfida: newSfid })
    if (qty === 1) popupApertura.value = { tipoPacchetto: 'sfida' }
    else emit('notif', `+${pAgg} bustine sfida aggiunte!`, '#ff8c00')
  } catch (e: any) {
    emit('notif', e?.data?.error || 'Errore acquisto', C.err)
  }
}

// ── Countdown omaggio ─────────────────────────────────────────
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

// ── 3D tilt per le bustine nel carosello ─────────────────────
const packTilts  = ref<Record<string, string>>({})
const packSheens = ref<Record<string, string>>({})
const hoveredPack = ref<string | null>(null)

function onPackHover(e: MouseEvent, id: string) {
  hoveredPack.value = id
  const el = (e.currentTarget as HTMLElement).querySelector('.pack-body') as HTMLElement
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width   // 0-1
  const y = (e.clientY - rect.top)  / rect.height  // 0-1
  const rotY =  (x - 0.5) * 22
  const rotX = -(y - 0.5) * 16
  packTilts.value  = { ...packTilts.value,  [id]: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.04)` }
  packSheens.value = { ...packSheens.value, [id]: `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)` }
}

function onPackLeave(id: string) {
  hoveredPack.value = null
  packTilts.value  = { ...packTilts.value,  [id]: 'rotateX(0deg) rotateY(0deg) scale(1)' }
  packSheens.value = { ...packSheens.value, [id]: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)' }
}
</script>

<template>
  <!-- ══════════════════════════════════════════════════════════
    SKELETON — visibile solo durante il primo caricamento dei drop
  ══════════════════════════════════════════════════════════════ -->
  <div v-if="dropsLoading" class="fade-in" :style="{ padding: '10px 0', position: 'relative' }">
    <!-- Petali stilizzati inline -->
    <div :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }">
      <span v-for="i in 4" :key="i" :style="{
        position: 'absolute',
        fontSize: '18px',
        opacity: 0.15,
        top: `${10 + i * 22}%`,
        left: `${5 + i * 23}%`,
        animation: 'float 4s ease-in-out infinite',
        animationDelay: `${i * 0.6}s`,
      }">🌸</span>
    </div>
    <div :style="{ position: 'relative', zIndex: 1, padding: '0 8px' }">
      <div :style="{ height: '60px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', marginBottom: '20px', animation: 'pulse 1.2s ease-in-out infinite' }" />
      <div :style="{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }">
        <div v-for="i in 3" :key="i" :style="{
          width: '100px', height: '140px', borderRadius: '14px',
          background: 'rgba(255,255,255,0.04)',
          animation: `pulse 1.2s ease-in-out ${(i-1) * 0.15}s infinite`,
        }" />
      </div>
      <div :style="{ textAlign: 'center', fontFamily: 'DM Sans,sans-serif', fontSize: '12px', color: 'rgba(241,235,255,0.3)' }">
        Caricamento drop stagionale…
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    REVEAL VIEW — rivelazione carte
  ══════════════════════════════════════════════════════════════ -->
  <div v-else-if="stato === 'reveal' || stato === 'reveal_multi'" class="fade-in" :style="{ padding: '14px 0', position: 'relative' }">
    <!-- Sakura petali -->
    <div :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }">
      <span v-for="i in 8" :key="i" :style="{
        position: 'absolute',
        fontSize: `${14 + (i % 3) * 4}px`,
        opacity: 0.18,
        top: `${(i * 13) % 100}%`,
        left: `${(i * 17) % 100}%`,
        animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
        animationDelay: `${i * 0.4}s`,
      }">🌸</span>
    </div>

    <div :style="{ position: 'relative', zIndex: 1 }">
      <!-- Header rivelazione -->
      <div :style="{ textAlign: 'center', marginBottom: '18px' }">
        <div :style="{
          fontFamily: FF.label, fontSize: '10px', color: C.goldL,
          letterSpacing: '0.42em', textTransform: 'uppercase', fontWeight: 700,
        }">
          ◆ Apertura Pacchetto
          <template v-if="stato === 'reveal_multi'">
            · {{ multiPackIndice + 1 }}/{{ multiPackCarte.length }}
          </template>
        </div>
        <div :style="{
          fontFamily: FF.display, fontSize: '28px', color: '#fff', fontWeight: 800,
          marginTop: '4px', letterSpacing: '-0.01em',
        }" class="shimmer-text">Rivelazione</div>
      </div>

      <!-- God Pack banner -->
      <div v-if="isGodPackAperto" :style="{
        textAlign: 'center', marginBottom: '22px', padding: '16px 22px',
        background: 'linear-gradient(135deg, rgba(245,197,96,0.22), rgba(255,126,182,0.22))',
        border: `2px solid ${C.gold}88`,
        borderRadius: '16px',
        boxShadow: `0 0 36px ${C.gold}55, inset 0 0 22px ${C.gold}1f`,
        animation: 'pulseStrong 1.5s infinite',
        position: 'relative', overflow: 'hidden',
      }">
        <div class="foil foil--soft" />
        <div :style="{
          position: 'relative', fontFamily: FF.display, fontSize: '18px', fontWeight: 800,
          letterSpacing: '0.08em', color: C.goldL,
          textShadow: `0 0 18px ${C.gold}`,
        }">✦ WAIFU GOD PACK ✦</div>
        <div :style="{
          position: 'relative', fontFamily: FF.label, fontSize: '10px',
          color: 'rgba(241,235,255,0.65)', letterSpacing: '0.32em',
          marginTop: '6px', textTransform: 'uppercase', fontWeight: 700,
        }">5 WAIFU TROVATE!</div>
      </div>

      <!-- Griglia carte -->
      <div :style="{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginTop: '18px' }">
        <div v-for="(c, i) in carteRivelate" :key="i" :style="{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }">
          <!-- Carta -->
          <div :style="{
            position: 'relative',
            opacity: i <= indiceRivelato ? 1 : 0.18,
            transform: i <= indiceRivelato ? 'scale(1)' : 'scale(0.85)',
            transition: 'all 0.6s',
            animation: i <= indiceRivelato && (c.data?.rarita === 'leggendario' || c.data?.rarita === 'immersivo')
              ? 'pulseStrong 1.2s infinite' : 'none',
          }">
            <!-- Carta coperta -->
            <div v-if="i > indiceRivelato" :style="{
              width: '143px', height: '215px', borderRadius: '14px',
              background: `radial-gradient(120% 80% at 50% 20%, ${C.gold}30, transparent 60%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
              border: `2px solid ${C.gold}55`,
              position: 'relative', overflow: 'hidden',
              display: 'grid', placeItems: 'center',
              boxShadow: `0 0 20px ${C.gold}33, inset 0 0 22px rgba(0,0,0,0.4)`,
            }">
              <div class="foil foil--soft" />
              <div :style="{ textAlign: 'center', position: 'relative', zIndex: 1 }">
                <div :style="{ fontFamily: FF.display, fontSize: '40px', color: C.gold, textShadow: `0 0 18px ${C.gold}aa` }">♛</div>
                <div :style="{
                  fontFamily: FF.label, fontSize: '8px', color: C.gold,
                  letterSpacing: '0.28em', marginTop: '6px', opacity: 0.85,
                  textTransform: 'uppercase', fontWeight: 700,
                }">Sigillato</div>
              </div>
            </div>

            <!-- Carta waifu rivelata -->
            <template v-else-if="c.tipo === 'waifu'">
              <CartaWaifu :waifu="c.data" dimensione="piccola" tipo="auto" style="cursor: pointer" />
            </template>

            <!-- Carta mossa rivelata -->
            <template v-else-if="c.tipo === 'mossa'">
              <CartaMossa :mossa="c.data" dimensione="piccola" />
            </template>

            <!-- Badge NEW -->
            <div v-if="i <= indiceRivelato && c.isNuova" :style="{
              position: 'absolute', top: '-6px', right: '-4px',
              background: `linear-gradient(135deg, ${C.gold}, ${C.sakura})`,
              color: '#1d0419',
              fontFamily: FF.label, fontSize: '8px', fontWeight: 800,
              padding: '2px 7px', borderRadius: '999px',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              boxShadow: `0 4px 12px ${C.sakura}66`,
              pointerEvents: 'none', zIndex: 10,
            }">NEW</div>
          </div>

          <!-- Copie waifu -->
          <div v-if="i <= indiceRivelato && c.tipo === 'waifu'" :style="{ textAlign: 'center', minHeight: '16px' }">
            <span v-if="(collezione?.waifu?.[c.data?.id]?.copie ?? 0) >= 3" :style="{
              fontFamily: FF.label, fontSize: '8px', color: C.ok,
              fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: '999px',
              background: `${C.ok}1a`, border: `1px solid ${C.ok}66`,
              textShadow: `0 0 6px ${C.ok}88`,
            }">⚡ Level Up!</span>
            <span v-else :style="{ fontFamily: FF.mono, fontSize: '9px', color: 'rgba(241,235,255,0.45)' }">
              {{ collezione?.waifu?.[c.data?.id]?.copie ?? 0 }}/3 copie
            </span>
          </div>

          <!-- Bottone video immersiva -->
          <button
            v-if="i <= indiceRivelato && c.tipo === 'waifu' && c.data?.rarita === 'immersivo'"
            @click="c.data?.asset_video ? avviaVideoSbusto(c.data) : undefined"
            :style="{
              background: c.data?.asset_video
                ? `linear-gradient(135deg, ${C.sakura}33, ${C.sakura}18)`
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${c.data?.asset_video ? C.sakura + '99' : C.sakura + '30'}`,
              borderRadius: '10px', color: c.data?.asset_video ? C.sakuraL : `${C.sakura}55`,
              fontFamily: FF.label, fontSize: '8px', fontWeight: 700,
              letterSpacing: '0.18em', padding: '6px 12px',
              cursor: c.data?.asset_video ? 'pointer' : 'not-allowed',
              boxShadow: c.data?.asset_video ? `0 0 14px ${C.sakura}30` : 'none',
              transition: 'all 0.2s', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }">
            <span :style="{ fontSize: '10px' }">▶</span>
            {{ c.data?.asset_video ? 'Vedi immersiva' : 'Video non disponibile' }}
          </button>
        </div>
      </div>

      <!-- CTA dopo rivelazione completa -->
      <div v-if="indiceRivelato >= carteRivelate.length - 1" :style="{ textAlign: 'center', marginTop: '26px' }">
        <!-- Prossimo pacchetto (multi) -->
        <BtnDecorato
          v-if="stato === 'reveal_multi' && multiPackIndice < multiPackCarte.length - 1"
          variant="primary" size="lg"
          @click="prossimoPackMulti"
        >
          PROSSIMO PACCHETTO ({{ multiPackIndice + 2 }}/{{ multiPackCarte.length }}) →
        </BtnDecorato>
        <!-- Fine rivelazione -->
        <BtnDecorato v-else variant="primary" size="lg" @click="tornaIdle">
          {{ stato === 'reveal_multi' ? `✅ FINE · ${multiPackCarte.length} PACCHETTI` : 'CONTINUA' }}
        </BtnDecorato>
      </div>
    </div>

    <!-- Video overlay carta immersiva -->
    <div
      v-if="sbusVideoAttivo && sbusCartaImmersiva"
      @click="sbusVideoFinito ? chiudiVideoSbusto() : undefined"
      :style="{
        position: 'fixed', inset: 0,
        background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(22px)',
        zIndex: 300, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }"
    >
      <div @click.stop :style="{ animation: 'scaleIn 0.2s ease-out' }">
        <CartaWaifu
          :waifu="sbusCartaImmersiva" dimensione="grande" tipo="auto"
          :video-attivo="sbusVideoAttivo"
          @video-end="sbusVideoFinito = true"
        />
        <video
          ref="sbusVideoRef"
          :src="sbusCartaImmersiva?.asset_video"
          :style="{ display: 'none' }"
          @ended="sbusVideoFinito = true"
        />
      </div>
      <div v-if="!sbusVideoFinito" :style="{
        marginTop: '18px', fontSize: '10px', color: 'rgba(241,235,255,0.35)',
        fontFamily: FF.label, letterSpacing: '0.26em',
        textTransform: 'uppercase', fontWeight: 600,
      }">In riproduzione…</div>
      <div v-if="sbusVideoFinito" @click.stop :style="{ marginTop: '18px', display: 'flex', gap: '10px' }">
        <BtnDecorato variant="secondary" size="md" @click="rivediVideoSbusto">↺ Rivedi</BtnDecorato>
        <BtnDecorato variant="danger" size="md" @click="chiudiVideoSbusto">✕ Chiudi</BtnDecorato>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════
    IDLE VIEW — selezione e apertura pacchetti
  ══════════════════════════════════════════════════════════════ -->
  <div v-else class="fade-in" :style="{ padding: '10px 0', position: 'relative' }">
    <!-- Sakura petali idle -->
    <div :style="{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }">
      <span v-for="i in 4" :key="i" :style="{
        position: 'absolute',
        fontSize: `${16 + (i % 2) * 6}px`,
        opacity: 0.12,
        top: `${(i * 27) % 90}%`,
        left: `${(i * 26) % 95}%`,
        animation: `float ${3.5 + i * 0.5}s ease-in-out infinite`,
        animationDelay: `${i * 0.7}s`,
      }">🌸</span>
    </div>

    <div :style="{ position: 'relative', zIndex: 1 }">



      <!-- Nessun drop attivo -->
      <div v-if="dropsAttivi.length === 0" :style="{
        textAlign: 'center', padding: '10px 14px', marginBottom: '14px',
        background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.inkLine}`,
        borderRadius: '12px', fontSize: '10px', color: 'rgba(241,235,255,0.45)',
        fontFamily: FF.label, letterSpacing: '0.22em',
        textTransform: 'uppercase', fontWeight: 700,
      }">Nessun drop attivo · tutte le carte disponibili</div>

      <!-- ◆ CAROSELLO 3D BUSTINE — selezione espansione ◆ -->
      <div v-if="dropsAttivi.length > 0" style="margin-bottom: 20px; padding-top: 8px;">
        <div style="
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          font-size: 9px; letter-spacing: 0.32em; color: rgba(245,197,96,0.6);
          text-transform: uppercase; font-weight: 700;
          text-align: center; margin-bottom: 16px;
        ">◆ Scegli il Drop</div>

        <!-- Carosello orizzontale con scroll-snap -->
        <div
          class="pack-carousel"
          style="
            display: flex; gap: 16px;
            overflow-x: auto; padding: 16px 20px 24px;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-start;
          "
        >
          <div
            v-for="d in dropsAttivi"
            :key="d.id"
            class="pack-card-3d"
            :class="{ 'pack-card-3d--selected': d.id === dropSelId }"
            @click="() => {
              if (dropSelId === d.id) {
                // Già selezionata: apri direttamente il pacchetto migliore disponibile
                if (nOmag > 0) popupApertura = { tipoPacchetto: 'omaggio' }
                else if (nBenv > 0) popupApertura = { tipoPacchetto: 'benvenuto' }
                else if (nSfid > 0) popupApertura = { tipoPacchetto: 'sfida' }
                else sfidaConferma = true
              } else {
                dropSelId = d.id
              }
            }"
            @mousemove="(e) => onPackHover(e, d.id)"
            @mouseleave="onPackLeave(d.id)"
            :data-pack-id="d.id"
            style="
              flex-shrink: 0;
              scroll-snap-align: center;
              perspective: 700px;
              cursor: pointer;
            "
          >
            <!-- Il corpo 3D della bustina -->
            <div
              class="pack-body"
              :style="{
                width: '150px',
                height: '220px',
                borderRadius: '14px',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.15s ease-out, box-shadow 0.2s',
                transform: packTilts[d.id] || 'rotateX(0deg) rotateY(0deg)',
                boxShadow: d.id === dropSelId
                  ? `0 20px 50px rgba(0,0,0,0.6), 0 0 0 2px ${d.colore || C.violet}, 0 0 30px ${d.colore || C.violet}55`
                  : '0 12px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                background: `linear-gradient(155deg, ${d.colore || '#a78bfa'} 0%, ${d.colore2 || '#ff85b6'} 50%, #07051a 100%)`,
                overflow: 'hidden',
              }"
            >
              <!-- Texture pattern overlay -->
              <div style="
                position: absolute; inset: 0; pointer-events: none;
                background-image: repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 11px);
                mix-blend-mode: overlay;
              " />

              <!-- Bordo metallico -->
              <div style="
                position: absolute; inset: 0; border-radius: inherit;
                border: 1.5px solid rgba(255,255,255,0.18);
                pointer-events: none; z-index: 10;
              " />

              <!-- Header fascia -->
              <div style="
                position: absolute; top: 0; left: 0; right: 0; height: 44px;
                background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 100%);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 1px;
                border-bottom: 1px solid rgba(255,255,255,0.12); z-index: 5;
              ">
                <div style="font-family: var(--ff-display,'Unbounded',sans-serif); font-size: 8px; letter-spacing: 3px; color: #f5c560; font-weight: 700; text-shadow: 0 0 8px rgba(245,197,96,0.8);">WAIFU'S</div>
                <div style="font-size: 6px; letter-spacing: 3px; color: rgba(255,255,255,0.5); text-transform: uppercase;">Empire · Card Game</div>
              </div>

              <!-- Immagine espansione / placeholder -->
              <div style="
                position: absolute; top: 44px; left: 0; right: 0; bottom: 44px;
                display: flex; align-items: center; justify-content: center;
                overflow: hidden;
              ">
                <img
                  v-if="d.asset_bustina"
                  :src="d.asset_bustina"
                  :alt="d.nome"
                  style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                />
                <div v-else style="
                  font-size: 48px; opacity: 0.55;
                  filter: drop-shadow(0 0 16px currentColor);
                ">🌸</div>
              </div>

              <!-- Shimmer olografico -->
              <div
                class="pack-sheen"
                :style="{
                  position: 'absolute', inset: 0, borderRadius: 'inherit',
                  background: packSheens[d.id] || 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none', zIndex: 8, transition: 'background 0.1s',
                  mixBlendMode: 'screen',
                }"
              />

              <!-- Rainbow holo overlay -->
              <div :style="{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                opacity: d.id === dropSelId ? 0.55 : (hoveredPack === d.id ? 0.4 : 0),
                background: 'linear-gradient(135deg, rgba(255,0,128,0.2) 0%, rgba(255,128,0,0.15) 20%, rgba(255,255,0,0.18) 40%, rgba(0,255,128,0.15) 60%, rgba(0,128,255,0.18) 80%, rgba(128,0,255,0.2) 100%)',
                pointerEvents: 'none', zIndex: 7, mixBlendMode: 'screen',
                transition: 'opacity 0.3s',
              }" />

              <!-- Footer fascia -->
              <div style="
                position: absolute; bottom: 0; left: 0; right: 0; height: 44px;
                background: linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 100%);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 1px;
                border-top: 1px solid rgba(255,255,255,0.08); z-index: 5;
              ">
                <div :style="{
                  fontFamily: FF.display, fontSize: '10px', fontWeight: 800,
                  letterSpacing: '2px', color: '#fff', lineHeight: 1,
                  textShadow: `0 0 16px ${d.colore || C.violet}cc`,
                }">{{ (d.nome || 'DROP').toUpperCase() }}</div>
                <div :style="{
                  fontSize: '7px', letterSpacing: '2px',
                  color: d.colore || C.violet, textTransform: 'uppercase', fontWeight: 700,
                  opacity: 0.85,
                }">{{ d.waifuIds?.length || 0 }} waifu · Serie {{ d.stagione || 1 }}</div>
              </div>

              <!-- Badge + CTA apertura sulla carta selezionata -->
              <div v-if="d.id === dropSelId" style="
                position: absolute; top: 8px; right: 8px;
                background: #f5c560; color: #07051a;
                font-family: var(--ff-label,'Saira Condensed',sans-serif);
                font-size: 7px; font-weight: 800;
                padding: 2px 6px; border-radius: 999px;
                letter-spacing: 0.1em; text-transform: uppercase;
                z-index: 20; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              ">✓ ATTIVA</div>
              <!-- Overlay "TAP PER APRIRE" sulla carta già selezionata -->
              <div v-if="d.id === dropSelId" style="
                position: absolute; bottom: 44px; left: 0; right: 0;
                background: linear-gradient(0deg, rgba(245,197,96,0.22), transparent);
                display: flex; align-items: center; justify-content: center;
                padding: 6px 0; z-index: 15; pointer-events: none;
              ">
                <div style="
                  font-family: var(--ff-label,'Saira Condensed',sans-serif);
                  font-size: 8px; letter-spacing: 0.18em; color: #ffe9a8;
                  text-transform: uppercase; font-weight: 700;
                  animation: pulse 1.4s ease-in-out infinite;
                ">▶ Tocca per aprire</div>
              </div>

            </div><!-- fine pack-body -->
          </div><!-- fine pack card -->
        </div><!-- fine carosello -->

        <!-- Dot indicator -->
        <div v-if="dropsAttivi.length > 1" style="display: flex; justify-content: center; gap: 6px; margin-top: 4px;">
          <div
            v-for="d in dropsAttivi"
            :key="d.id"
            @click="dropSelId = d.id"
            :style="{
              width: d.id === dropSelId ? '18px' : '6px',
              height: '6px',
              borderRadius: '999px',
              background: d.id === dropSelId ? (d.colore || C.violet) : 'rgba(255,255,255,0.2)',
              transition: 'all 0.25s',
              cursor: 'pointer',
            }"
          />
        </div>
      </div>

      <!-- Modal conferma acquisto sfida -->
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
          <div :style="{
            fontFamily: FF.label, fontSize: '11px', color: C.sakura,
            letterSpacing: '0.32em', marginBottom: '10px',
            textTransform: 'uppercase', fontWeight: 700,
          }">Acquista Bustina</div>
          <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.8)', marginBottom: '18px' }">
            Scegli quante bustine Sfida acquistare:
          </div>
          <div :style="{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '16px' }">
            <button @click="acquistaSfidaConKisses(1)" :style="{
              background: `${C.sakura}1f`, border: `1px solid ${C.sakura}66`,
              borderRadius: '10px', color: C.sakuraL,
              fontFamily: FF.label, fontSize: '10px', fontWeight: 700,
              padding: '11px 16px', cursor: 'pointer',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }">🎁 1 bustina · {{ SFIDA_COSTO_KISSES }} Kisses</button>
            <button @click="(profilo?.kisses ?? 0) >= SFIDA_COSTO_10 ? acquistaSfidaConKisses(10) : (sfidaConferma = false, sfidaShortage = true)" :style="{
              background: `linear-gradient(135deg, ${C.gold}26, ${C.sakura}1f)`,
              border: `1px solid ${C.gold}66`,
              borderRadius: '10px', color: C.goldL,
              fontFamily: FF.label, fontSize: '10px', fontWeight: 700,
              padding: '11px 16px', cursor: 'pointer',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }">🎁×10 · {{ SFIDA_COSTO_10 }} Kisses</button>
          </div>
          <button @click="sfidaConferma = false" :style="{
            background: 'none', border: `1px solid ${C.inkLine}`,
            borderRadius: '9px', color: 'rgba(241,235,255,0.5)',
            fontFamily: FF.label, fontSize: '10px',
            padding: '10px 16px', cursor: 'pointer', width: '100%',
            letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
          }">Annulla</button>
        </div>
      </div>

      <!-- Modal shortage kisses -->
      <KissesShortageModal
        v-if="sfidaShortage"
        :missing-kisses="Math.max(SFIDA_COSTO_KISSES, SFIDA_COSTO_10) - (profilo?.kisses ?? 0)"
        :current-kisses="profilo?.kisses ?? 0"
        @success="(newKisses: number) => { emit('updateProfilo', { kisses: newKisses }); sfidaShortage = false; sfidaConferma = true }"
        @cancel="sfidaShortage = false"
      />

      <!-- Griglia PackCard -->
      <div :style="{
        display: 'grid',
        gridTemplateColumns: `repeat(${nBenv > 0 ? 3 : 2}, minmax(120px, 1fr))`,
        gap: '10px', justifyContent: 'center', marginBottom: '16px',
      }">
        <!-- Omaggio -->
        <SbustaPackCard
          tipo="omaggio"
          :count="nOmag"
          :max="2"
          :color="C.gold"
          :color2="C.goldL"
          icona="🎁"
          label="OMAGGIO"
          sub="Gratis ogni 12h"
          :esaurito="nOmag <= 0"
          :asset="dropAttivo?.asset_bustina"
          :ff="FF"
          @click="nOmag > 0 && (popupApertura = { tipoPacchetto: 'omaggio' })"
        >
          <template #cta-esaurito>
            <div :style="{
              fontFamily: FF.mono, fontSize: '10px', color: C.goldL,
              fontWeight: 700, textShadow: `0 0 8px ${C.goldL}80`,
            }">{{ countdown || '—' }}</div>
          </template>
        </SbustaPackCard>

        <!-- Sfida -->
        <SbustaPackCard
          tipo="sfida"
          :count="nSfid"
          :max="null"
          :color="C.sakura"
          color2="#ff6b6b"
          icona="⚔"
          label="SFIDA"
          sub="Vinci in battaglia"
          :esaurito="nSfid <= 0"
          :asset="dropAttivo?.asset_bustina"
          :ff="FF"
          @click="nSfid > 0 && (popupApertura = { tipoPacchetto: 'sfida' })"
        />

        <!-- Benvenuto -->
        <SbustaPackCard
          v-if="nBenv > 0"
          tipo="benvenuto"
          :count="nBenv"
          :max="null"
          :color="C.ok"
          color2="#00bfa5"
          icona="⭐"
          label="BENVENUTO"
          sub="No doppioni"
          :esaurito="false"
          :asset="dropAttivo?.asset_bustina"
          :ff="FF"
          @click="popupApertura = { tipoPacchetto: 'benvenuto' }"
        />

        <!-- Bottone acquisto con kisses (se sfida esaurita) -->
        <button
          v-if="nSfid <= 0"
          @click="(profilo?.kisses ?? 0) >= SFIDA_COSTO_KISSES ? (sfidaConferma = true) : (sfidaShortage = true)"
          :style="{
            gridColumn: '2',
            background: `linear-gradient(180deg, ${C.sakura}26, ${C.sakura}10)`,
            border: `1px solid ${C.sakura}66`, borderRadius: '11px',
            color: C.sakuraL, fontFamily: FF.label, fontSize: '9px',
            padding: '8px 0', cursor: 'pointer', letterSpacing: '0.18em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: `0 0 12px ${C.sakura}22`,
            fontWeight: 700, textTransform: 'uppercase',
          }"
        >
          <KissesIcon :size="11" /> {{ SFIDA_COSTO_KISSES }} KISSES
        </button>
      </div>

      <!-- Manga Banner (drop con asset_manga) -->
      <div v-if="dropAttivo?.asset_manga" :style="{
        margin: '4px 0 16px', borderRadius: '16px', overflow: 'hidden', position: 'relative',
        background: dropCompleto
          ? `linear-gradient(135deg, ${dropColore}26, ${dropColore2}1a)`
          : 'linear-gradient(135deg, rgba(27,22,56,0.85), rgba(13,10,38,0.92))',
        border: dropCompleto ? `1.5px solid ${dropColore}` : `1px solid ${C.inkLine}`,
        boxShadow: dropCompleto ? `0 0 26px ${dropColore}40` : 'none',
      }">
        <div :style="{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: dropCompleto
            ? `linear-gradient(90deg, ${dropColore}, ${dropColore2}, ${dropColore})`
            : `linear-gradient(90deg, ${C.violet}33, ${C.sakura}33)`,
        }" />
        <div :style="{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }">
          <div :style="{
            flexShrink: 0, width: '50px', height: '50px', borderRadius: '11px',
            background: dropCompleto ? `linear-gradient(135deg, ${dropColore}60, ${dropColore2}40)` : `${C.violet}1a`,
            border: `1px solid ${dropCompleto ? dropColore : C.violet + '55'}`,
            display: 'grid', placeItems: 'center', fontSize: '26px',
            boxShadow: dropCompleto ? `0 0 12px ${dropColore}55` : 'none',
          }">{{ dropCompleto ? '📖' : '🔒' }}</div>
          <div :style="{ flex: 1, minWidth: 0 }">
            <div :style="{
              fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em',
              color: dropCompleto ? dropColore : 'rgba(241,235,255,0.45)',
              textTransform: 'uppercase', fontWeight: 700, marginBottom: '3px',
            }">{{ dropCompleto ? '✦ Capitolo sbloccato' : 'Capitolo manga' }}</div>
            <div :style="{
              fontFamily: FF.display, fontSize: '13px', fontWeight: 700,
              color: dropCompleto ? '#fff' : 'rgba(241,235,255,0.75)',
              marginBottom: '5px',
            }">{{ dropAttivo.nome }}</div>
            <div v-if="dropCompleto" :style="{ fontSize: '10px', color: 'rgba(241,235,255,0.6)', lineHeight: 1.4, fontFamily: FF.body }">
              Hai completato il drop! Il capitolo è tuo.
            </div>
            <template v-else>
              <div :style="{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '4px' }">
                <div :style="{
                  height: '100%', borderRadius: '3px', width: `${progDrop.percentuale}%`,
                  background: `linear-gradient(90deg, ${dropColore}, ${dropColore2})`,
                  transition: 'width 0.5s', boxShadow: `0 0 6px ${dropColore}88`,
                }" />
              </div>
              <div :style="{ fontFamily: FF.mono, fontSize: '9px', color: 'rgba(241,235,255,0.5)' }">
                {{ progDrop.possedute }}/{{ progDrop.totale }} carte · {{ progDrop.percentuale }}% completato
              </div>
            </template>
          </div>
          <div :style="{ flexShrink: 0 }">
            <a v-if="dropCompleto"
              :href="dropAttivo.asset_manga" target="_blank" rel="noreferrer" download
              :style="{
                display: 'inline-block', padding: '8px 14px',
                background: `linear-gradient(135deg, ${dropColore}, ${dropColore2})`,
                color: '#000', fontFamily: FF.label, fontSize: '9px',
                fontWeight: 800, letterSpacing: '0.18em',
                borderRadius: '9px', textDecoration: 'none', textAlign: 'center',
                boxShadow: `0 0 14px ${dropColore}66`, whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }">⬇ Scarica</a>
            <div v-else :style="{
              padding: '8px 11px',
              background: `${C.violet}14`, border: `1px solid ${C.violet}45`,
              borderRadius: '9px', textAlign: 'center',
              fontFamily: FF.label, fontSize: '8px',
              color: 'rgba(241,235,255,0.45)',
              letterSpacing: '0.18em', whiteSpace: 'nowrap',
              textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.3,
            }">Ancora<br/>{{ progDrop.totale - progDrop.possedute }} carte</div>
          </div>
        </div>
      </div>

      <!-- Popup apertura pacchetto -->
      <div v-if="popupApertura" @click="popupApertura = null" :style="{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }">
        <div @click.stop :style="{
          background: 'linear-gradient(180deg, rgba(27,22,56,0.96), rgba(13,10,38,0.98))',
          border: `1.5px solid ${
            popupApertura.tipoPacchetto === 'omaggio' ? C.gold :
            popupApertura.tipoPacchetto === 'sfida'   ? C.sakura : C.ok
          }66`,
          borderRadius: '22px',
          padding: '24px 24px 18px', maxWidth: '340px', width: '100%', textAlign: 'center',
          boxShadow: `0 24px 60px rgba(3,2,12,0.85), 0 0 50px ${
            popupApertura.tipoPacchetto === 'omaggio' ? C.gold :
            popupApertura.tipoPacchetto === 'sfida'   ? C.sakura : C.ok
          }33`,
          position: 'relative', overflow: 'hidden',
        }">
          <div class="foil foil--soft" />
          <div :style="{ position: 'relative' }">
            <img v-if="dropAttivo?.asset_bustina" :src="dropAttivo.asset_bustina" alt="" :style="{
              width: '100px', height: '100px', objectFit: 'cover', borderRadius: '16px', margin: '0 auto 14px',
              border: `2px solid ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}66`,
              boxShadow: `0 0 22px ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}55`,
            }" />
            <div v-else :style="{
              width: '100px', height: '100px', borderRadius: '16px', margin: '0 auto 14px',
              background: `linear-gradient(135deg, ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold + '45' : popupApertura.tipoPacchetto === 'sfida' ? C.sakura + '45' : C.ok + '45'}, ${popupApertura.tipoPacchetto === 'omaggio' ? C.goldL + '28' : popupApertura.tipoPacchetto === 'sfida' ? '#ff6b6b28' : '#00bfa528'})`,
              border: `2px solid ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}66`,
              display: 'grid', placeItems: 'center', fontSize: '46px',
              boxShadow: `0 0 22px ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}44`,
            }">{{ popupApertura.tipoPacchetto === 'omaggio' ? '🎁' : popupApertura.tipoPacchetto === 'sfida' ? '⚔' : '⭐' }}</div>

            <div v-if="dropAttivo" :style="{
              fontFamily: FF.label, fontSize: '9px',
              color: popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok,
              letterSpacing: '0.28em', marginBottom: '4px',
              textTransform: 'uppercase', fontWeight: 700,
            }">{{ dropAttivo.nome }}</div>

            <div :style="{
              fontFamily: FF.display, fontSize: '18px', fontWeight: 700, color: '#fff',
              letterSpacing: '-0.005em', marginBottom: '6px',
            }">
              {{ popupApertura.tipoPacchetto === 'omaggio' ? '🎁' : popupApertura.tipoPacchetto === 'sfida' ? '⚔' : '⭐' }}
              Pacchetto {{ popupApertura.tipoPacchetto === 'omaggio' ? 'OMAGGIO' : popupApertura.tipoPacchetto === 'sfida' ? 'SFIDA' : 'BENVENUTO' }}
            </div>

            <div :style="{
              fontFamily: FF.mono, fontSize: '12px',
              color: popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok,
              marginBottom: '22px', fontWeight: 700,
            }">
              {{
                popupApertura.tipoPacchetto === 'benvenuto' ? nBenv :
                popupApertura.tipoPacchetto === 'omaggio'   ? nOmag : nSfid
              }}
              {{
                (popupApertura.tipoPacchetto === 'benvenuto' ? nBenv :
                 popupApertura.tipoPacchetto === 'omaggio'   ? nOmag : nSfid) === 1
                ? 'pacchetto disponibile' : 'pacchetti disponibili'
              }}
            </div>

            <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px' }">
              <button @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apri(t) }" :style="{
                padding: '14px 20px', borderRadius: '12px', cursor: 'pointer',
                background: `linear-gradient(135deg, ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold + ', ' + C.goldL : popupApertura.tipoPacchetto === 'sfida' ? C.sakura + ', #ff6b6b' : C.ok + ', #00bfa5'})`,
                border: 'none', color: '#000',
                fontFamily: FF.label, fontSize: '12px', fontWeight: 800,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                boxShadow: `0 0 22px ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok}55, 0 6px 16px rgba(0,0,0,0.4)`,
                transition: 'all 0.15s',
              }">🎴 Apri 1 Pacchetto</button>

              <button
                @click="() => { const t = popupApertura!.tipoPacchetto; popupApertura = null; apriMulti(t) }"
                :disabled="(popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) < 10"
                :style="{
                  padding: '14px 20px', borderRadius: '12px',
                  cursor: (popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) >= 10 ? 'pointer' : 'not-allowed',
                  background: (popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) >= 10
                    ? `linear-gradient(135deg, ${popupApertura.tipoPacchetto === 'omaggio' ? C.gold + '33, ' + C.goldL + '22' : popupApertura.tipoPacchetto === 'sfida' ? C.sakura + '33, #ff6b6b22' : C.ok + '33, #00bfa522'})`
                    : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${(popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) >= 10 ? (popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok) : 'rgba(255,255,255,0.1)'}`,
                  color: (popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) >= 10
                    ? (popupApertura.tipoPacchetto === 'omaggio' ? C.gold : popupApertura.tipoPacchetto === 'sfida' ? C.sakura : C.ok)
                    : 'rgba(241,235,255,0.25)',
                  fontFamily: FF.label, fontSize: '12px', fontWeight: 800,
                  letterSpacing: '0.22em', textTransform: 'uppercase', transition: 'all 0.15s',
                }"
              >
                🎴×10 Apri 10 Pacchetti
                <div v-if="(popupApertura.tipoPacchetto === 'benvenuto' ? nBenv : popupApertura.tipoPacchetto === 'omaggio' ? nOmag : nSfid) < 10" :style="{
                  fontSize: '8px', fontWeight: 500, marginTop: '4px',
                  letterSpacing: '0.12em', textTransform: 'none', fontFamily: FF.body,
                }">(servono almeno 10 pacchetti)</div>
              </button>

              <button @click="popupApertura = null" :style="{
                padding: '8px', borderRadius: '8px', cursor: 'pointer',
                background: 'none', border: 'none',
                color: 'rgba(241,235,255,0.45)',
                fontFamily: FF.label, fontSize: '10px',
                letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
              }">Annulla</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
