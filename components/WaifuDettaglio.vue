<!-- ============================================================
  WaifuDettaglio — Modal dettaglio carta waifu.
  Layout unico: chip tipo/lv/copie sulla carta, stats collassabili,
  battaglia+mosse collassabili con picker compatibilità.
  ============================================================ -->
<script setup lang="ts">
import { Heart, X, ChevronDown, ChevronUp, Swords, Plus, Trash2, Sparkles } from 'lucide-vue-next'
import { canLearnMove, weakType } from '~/utils/moves'
import { moves as MOVES_DATA } from '~/assets/moves/moves-data'
import MoveCard from '~/components/moves/MoveCard.vue'
import { resolveWaifuStat, AESTHETIC_STAT_CAPS, type AestheticStatKey } from '~/utils/waifuStats'
import { computeHp, computeSpeed, computeCritChance } from '~/utils/battleEngine'
import { RARITY_MULTIPLIERS_DEFAULT } from '~/utils/constants'

const { t } = useI18n()

// Traduce il tipo elementale (Fuoco→Fire, ...) con fallback al valore grezzo
const typeLabel = (v?: string | null) => v ? t('types.' + String(v).toLowerCase()) : ''

const props = defineProps<{
  waifuId: string
  waifu: any
  dati: any
  mosseCat: any[]
  mosseCollezione: Record<string, any>
  waifuCollezione: Record<string, any>
  waifuCat: any[]
}>()

const emit = defineEmits<{
  chiudi: []
  togglePreferita: []
  assegnaMossa: [slot: string, mossaId: string]
  rimuoviMossa: [slot: string]
  /** #21: assegna in blocco piu' mosse (One-Click) con un solo salvataggio */
  assegnaMosseMultiple: [assignments: { slot: string; mossaId: string }[]]
  levelUp: []
}>()

// Tipo elementale della waifu risolto come in battaglia (tipo → tipologia →
// _battleStats.type): prima il picker leggeva SOLO waifu.tipo, spesso assente,
// quindi il vincolo di debolezza non veniva mai applicato.
const waifuTipo = computed<string | undefined>(() => {
  const w = props.waifu as any
  const d = props.dati as any
  return (w?.tipo ?? w?.tipologia ?? d?.tipo ?? d?.type ?? d?._battleStats?.type ?? d?.battleStats?.type) as string | undefined
})

const FF = {
  display: "var(--ff-display,'Fredoka',sans-serif)",
  label:   "var(--ff-label,'Saira Condensed',sans-serif)",
  mono:    "var(--ff-mono,'JetBrains Mono',monospace)",
  body:    "var(--ff-body,'DM Sans',sans-serif)",
}
const C = { gold: '#f5c560', goldL: '#ffe9a8', violet: '#a78bfa', ok: '#58e0a3', err: '#ff5b6c', sakura: '#ff85b6', aqua: '#6cf0e0' }

const RAR_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
const STELLE: Record<string, string> = { comune: '★', raro: '★★', epico: '★★★', leggendario: '★★★★', immersivo: '★★★★★' }

// Colori tipo elemento
const TIPO_C: Record<string, { bg: string; border: string; txt: string }> = {
  fuoco:   { bg: 'rgba(239,68,68,0.18)',   border: '#ef444499', txt: '#fca5a5' },
  acqua:   { bg: 'rgba(59,130,246,0.18)',  border: '#3b82f699', txt: '#93c5fd' },
  natura:  { bg: 'rgba(34,197,94,0.18)',   border: '#22c55e99', txt: '#86efac' },
  chrono:  { bg: 'rgba(63,208,200,0.18)',  border: '#2bb3a899', txt: '#7fe6de' },
  arcana:  { bg: 'rgba(168,85,247,0.18)',  border: '#a855f799', txt: '#d8b4fe' },
  abisso:  { bg: 'rgba(99,102,241,0.18)',  border: '#6366f199', txt: '#c7d2fe' },
  ferro:   { bg: 'rgba(156,163,175,0.18)', border: '#9ca3af99', txt: '#e5e7eb' },
  luce:    { bg: 'rgba(250,204,21,0.18)',  border: '#facc1599', txt: '#fef08a' },
  ombra:   { bg: 'rgba(107,114,128,0.18)', border: '#6b728099', txt: '#d1d5db' },
}
function tc(tipo?: string | null) {
  return TIPO_C[tipo?.toLowerCase() ?? ''] ?? { bg: 'rgba(245,197,96,0.12)', border: '#f5c56066', txt: '#f5c560' }
}

// Stat definizioni
const STAT_DEFS = [
  { key: 'tette',          label: 'Prosperosità', icon: '✨', max: 10 },
  { key: 'colore_capelli', label: 'Acconciatura', icon: '💇', max: 10 },
  { key: 'eta',            label: 'Maturità',     icon: '⌛', max: 10 },
  { key: 'taglia_piedi',   label: 'Portamento',   icon: '👠', max: 10 },
  { key: 'esperienza',     label: 'Esperienza',   icon: '⭐', max: 10 },
]

// Accordion
const statsOpen  = ref(false)
// Overlay video immersiva (solo carte con asset_video)
// Il bottone 'Guarda immersiva' appare solo se il file esiste davvero (HEAD 1x)
const videoOk = ref(false)
watch(() => (props.waifu as any)?.asset_video, (u) => {
  videoOk.value = false
  if (u) videoExists(u).then((ok) => { videoOk.value = ok })
}, { immediate: true })
const videoOpen  = ref(false)
const videoError = ref(false)
const battleOpen = ref(false)
const slotPicker = ref<string | null>(null)

// La carta si rimpicciolisce quando UNA o ENTRAMBE le sezioni sotto (Statistiche
// e Mosse) sono aperte, per lasciare loro spazio; con entrambe chiuse resta
// grande. Nessun legame con lo scroll (comportamento rimosso su richiesta).
const cardShrink = computed(() => statsOpen.value || battleOpen.value)
const cardOuter = ref<HTMLElement | null>(null)
const cardOuterH = ref(0)
function measureCard() {
  if (cardOuter.value) cardOuterH.value = cardOuter.value.offsetHeight
}
const cardShrinkStyle = computed(() => ({
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  overflow: 'visible',
  transformOrigin: 'top center',
  transition: 'transform 0.3s ease, margin-bottom 0.3s ease, padding 0.3s ease',
  transform: cardShrink.value ? 'scale(0.6)' : 'none',
  marginBottom: cardShrink.value ? `-${Math.round(cardOuterH.value * 0.28)}px` : '0px',
  // Top più alto: i chip sbordano di -20px sopra la carta → senza spazio si schiacciano
  padding: cardShrink.value ? '12px 16px 4px' : '26px 16px 26px',
}))
onMounted(() => { nextTick(measureCard) })
watch([statsOpen, battleOpen], () => { nextTick(measureCard) })

// Mosse
const SLOTS = ['1', '2', '3', '4']
const mosseSlot = computed(() => props.dati.mosse_slot ?? {})

function mossaInSlot(slot: string) {
  const id = mosseSlot.value[slot]
  return id ? props.mosseCat.find((m: any) => m.id === id) : null
}

// Colore rarità
const rarColor = computed(() => {
  const m: Record<string, string> = {
    comune: '#9ca3af', raro: '#3b82f6', epico: '#a855f7',
    leggendario: '#f59e0b', immersivo: '#ec4899',
  }
  return m[props.waifu.rarita] ?? '#9ca3af'
})
const waifuRarIdx = computed(() => RAR_ORDER.indexOf(props.waifu.rarita ?? 'comune'))

// Compatibilità mossa: unico vincolo è la debolezza di tipo.
// Le mosse NON sono univoche (possono stare su più waifu); nessun limite di rarità.
function compat(mossaId: string, slot: string): { ok: boolean; motivo?: string } {
  const m = props.mosseCat.find((x: any) => x.id === mossaId)
  if (!m) return { ok: false, motivo: t('card.not_in_catalog') }

  // La waifu non può imparare la mossa del tipo a cui è debole
  if (!canLearnMove(waifuTipo.value, (m.type ?? m.tipologia) as string))
    return { ok: false, motivo: `Debole a ${weakType(waifuTipo.value)?.toUpperCase() ?? '?'}` }

  // Stessa mossa già in un altro slot di QUESTA waifu
  if (SLOTS.filter(s => s !== slot).some(s => mosseSlot.value[s] === mossaId))
    return { ok: false, motivo: t('card.already_assigned') }

  return { ok: true }
}

const nonCompatOpen = ref(false)
// Reset stato collapsible quando si cambia slot
watch(slotPicker, () => { nonCompatOpen.value = false })

// #21: "One Click" — assegna automaticamente 4 mosse casuali COMPATIBILI
// (rispetta il vincolo di tipo) prese tra quelle possedute, una per slot.
function oneClickMosse() {
  const compatibili = Object.keys(props.mosseCollezione).filter(id => {
    const cat = props.mosseCat.find((m: any) => m.id === id)
    return cat && canLearnMove(waifuTipo.value, (cat.type ?? cat.tipologia) as string)
  })
  if (compatibili.length === 0) return
  // Mescola e prendi fino a 4 mosse distinte
  const shuffled = [...compatibili].sort(() => Math.random() - 0.5).slice(0, 4)
  const assignments = shuffled.map((mossaId, i) => ({ slot: SLOTS[i], mossaId }))
  emit('assegnaMosseMultiple', assignments)
}

// #20: mappa la mossa del catalogo Firestore nel formato atteso da MoveCard
// (che usa name/type/damage/effectDescription) così si vede la CARTA COMPLETA.
function toMoveCard(cat: any) {
  // Descrizione effetto: preferisci il testo meccanico completo da moves-data
  // (spesso il catalogo Firestore non ha né effect né abilita → card senza scritte)
  const md = MDATA_BY_ID[cat.id]
  return {
    id: cat.id,
    name: cat.nome ?? cat.name ?? '',
    type: String(cat.tipologia ?? cat.tipo ?? 'arcana').toLowerCase(),
    damage: cat.danno ?? 0,
    rarita: cat.rarita,
    isUltimate: cat.isUltimate === true,
    effectDescription: cat.abilita || md?.effectDescription || cat.effect?.label || md?.effect?.label || '',
    additionalEffectLabel: md?.additionalEffectLabel ?? cat.effect?.label ?? md?.effect?.label ?? '',
    imageFileName: cat.imageFileName ?? '', imageUrl: cat.imageUrl ?? '',
  }
}

const pickerMosse = computed(() => {
  if (!slotPicker.value) return []
  return Object.entries(props.mosseCollezione)
    .map(([id, dati]) => {
      const cat = props.mosseCat.find((m: any) => m.id === id)
      if (!cat) return null
      const c = compat(id, slotPicker.value!)
      return { id, dati, cat, ok: c.ok, motivo: c.motivo }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.ok ? 1 : 0) - (a!.ok ? 1 : 0)) as { id: string; dati: any; cat: any; ok: boolean; motivo?: string }[]
})

// ── Filtri + ordinamento del picker mosse ────────────────────────────────────
// Gli effetti strutturati (kind) vengono da moves-data mappati per id.
const EFFECT_BY_ID: Record<string, any> = Object.fromEntries(
  (MOVES_DATA as any[]).map(m => [m.id, m.effect]),
)
// Mappa completa moves-data per id (per descrizioni/etichette effetto nel picker)
const MDATA_BY_ID: Record<string, any> = Object.fromEntries(
  (MOVES_DATA as any[]).map(m => [m.id, m]),
)
function moveEffKind(cat: any): string | null {
  return (cat?.effect?.kind ?? EFFECT_BY_ID[cat?.id]?.kind) ?? null
}
// Attacco = effetti sul nemico (danno nel tempo/controllo/debuff); Difesa = su di sé (buff/scudo)
const ATTACK_KINDS  = ['dot', 'control', 'debuff']
const DEFENSE_KINDS = ['buff', 'shield']
const hasSideEffect = (cat: any) => !!moveEffKind(cat)
const isAttackEff   = (cat: any) => { const k = moveEffKind(cat); return !!k && ATTACK_KINDS.includes(k) }
const isDefenseEff  = (cat: any) => { const k = moveEffKind(cat); return !!k && DEFENSE_KINDS.includes(k) }

const pickerSort    = ref<'potenza_desc' | 'potenza_asc' | 'tipo' | 'nome'>('potenza_desc')
const pickerFTipo   = ref<string>('')                                   // '' = tutti i tipi
const pickerFEff    = ref<'tutti' | 'collaterali' | 'attacco' | 'difesa'>('tutti')
// Reset dei filtri ogni volta che si (ri)apre il picker
watch(slotPicker, () => { pickerFTipo.value = ''; pickerFEff.value = 'tutti'; pickerSort.value = 'potenza_desc' })

const pickerTipi = computed<string[]>(() => {
  const s = new Set<string>()
  for (const m of pickerMosse.value) { const tp = m.cat.tipologia ?? m.cat.tipo; if (tp) s.add(String(tp)) }
  return [...s].sort()
})

const pickerCompatibili = computed(() => {
  let out = pickerMosse.value.filter(m => m.ok)
  if (pickerFTipo.value) out = out.filter(m => String(m.cat.tipologia ?? m.cat.tipo) === pickerFTipo.value)
  if (pickerFEff.value === 'collaterali') out = out.filter(m => hasSideEffect(m.cat))
  else if (pickerFEff.value === 'attacco') out = out.filter(m => isAttackEff(m.cat))
  else if (pickerFEff.value === 'difesa')  out = out.filter(m => isDefenseEff(m.cat))
  const arr = [...out]
  const nome = (m: any) => String(m.cat.nome ?? m.cat.name ?? '')
  const tipo = (m: any) => String(m.cat.tipologia ?? m.cat.tipo ?? '')
  if (pickerSort.value === 'potenza_desc') arr.sort((a, b) => (b.cat.danno ?? 0) - (a.cat.danno ?? 0))
  else if (pickerSort.value === 'potenza_asc') arr.sort((a, b) => (a.cat.danno ?? 0) - (b.cat.danno ?? 0))
  else if (pickerSort.value === 'tipo') arr.sort((a, b) => tipo(a).localeCompare(tipo(b)) || (b.cat.danno ?? 0) - (a.cat.danno ?? 0))
  else if (pickerSort.value === 'nome') arr.sort((a, b) => nome(a).localeCompare(nome(b)))
  return arr
})

// Stili chip filtri/ordinamento
const chipBase: Record<string, string | number> = {
  fontFamily: FF.label, fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em',
  textTransform: 'uppercase', padding: '6px 11px', borderRadius: '999px',
  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid var(--theme-border)',
}
function chipStyle(active: boolean, color = C.violet): Record<string, string | number> {
  return {
    ...chipBase,
    background: active ? color : 'var(--theme-surface-2)',
    color: active ? '#fff' : 'var(--theme-text-2)',
    borderColor: active ? color : 'var(--theme-border)',
  }
}
const chipLabelStyle: Record<string, string> = {
  fontFamily: FF.label, fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--theme-text-3)', alignSelf: 'center',
  flexShrink: '0', paddingRight: '2px',
}
const SORT_OPTS = [
  { k: 'potenza_desc', l: 'Potenza ↓' },
  { k: 'potenza_asc',  l: 'Potenza ↑' },
  { k: 'tipo',         l: 'Tipo' },
  { k: 'nome',         l: 'Nome' },
] as const
const EFF_OPTS = [
  { k: 'tutti',       l: 'Tutti' },
  { k: 'collaterali', l: 'Con effetti' },
  { k: 'attacco',     l: 'Attacco' },
  { k: 'difesa',      l: 'Difesa' },
] as const

// Valore statistica: reale dal catalogo se presente, altrimenti GENERATO in modo
// deterministico dall'id (identico a quello mostrato sulla carta — utils/waifuStats).
function statVal(key: string) {
  const v = resolveWaifuStat(props.waifu, key as AestheticStatKey) + (props.dati.stat_bonus?.[key] ?? 0)
  const cap = AESTHETIC_STAT_CAPS[key as AestheticStatKey]
  return cap != null ? Math.min(cap, v) : v
}
function statPct(key: string, max: number) {
  return Math.min(100, (statVal(key) / max) * 100)
}

// HP/Vel/Crit: stessi fallback derivati usati da CartaWaifu, così il dettaglio
// non mostra mai 0 quando la carta mostra un valore calcolato.
const _rarMult = computed(() =>
  (RARITY_MULTIPLIERS_DEFAULT as Record<string, { multiplier: number }>)[props.waifu.rarita]?.multiplier ?? 1)
const hp    = computed(() =>
  props.dati.hp ?? props.waifu.hp ?? props.waifu.battleStats?.maxHp ?? computeHp(props.waifu, _rarMult.value))
const vel   = computed(() =>
  props.dati.velocita ?? props.waifu.velocita_base ?? props.waifu.battleStats?.speed ?? Math.round(computeSpeed(props.waifu)))
const crit  = computed(() =>
  props.dati.crit_chance ?? props.waifu.crit_chance_base ?? computeCritChance(props.waifu, _rarMult.value))
const lv    = computed(() => props.dati.livello ?? 1)
const copie = computed(() => props.dati.copie ?? 0)
const pref  = computed(() => !!props.dati.preferita)

// CSS tilt per l'intera carta (frame + immagine ruotano insieme)
const cardWrap = ref<HTMLElement | null>(null)
let tiltId: number | null = null
let tTX = 0, tTY = 0, cTX = 0, cTY = 0
const tiltTr = ref('perspective(1000px) rotateX(0deg) rotateY(0deg)')

function onCardMove(e: PointerEvent) {
  const el = cardWrap.value; if (!el) return
  const rc = el.getBoundingClientRect()
  tTY = ((e.clientX - rc.left) / rc.width  - 0.5) * 16
  tTX = -((e.clientY - rc.top)  / rc.height - 0.5) * 11
}
function onCardTouch(e: TouchEvent) {
  const el = cardWrap.value; if (!el) return
  const rc = el.getBoundingClientRect()
  tTY = ((e.touches[0].clientX - rc.left) / rc.width  - 0.5) * 16
  tTX = -((e.touches[0].clientY - rc.top)  / rc.height - 0.5) * 11
}
function onCardLeave() { tTX = 0; tTY = 0 }

function loopTilt() {
  cTX += (tTX - cTX) * 0.1
  cTY += (tTY - cTY) * 0.1
  tiltTr.value = `perspective(1000px) rotateX(${cTX.toFixed(2)}deg) rotateY(${cTY.toFixed(2)}deg)`
  tiltId = requestAnimationFrame(loopTilt)
}

// Blocca lo scroll della pagina sottostante (incluso iOS) tramite il composable
// condiviso, token-based: coordinato con tutti gli altri modali → niente leak.
useScrollLock(true)
onMounted(() => { loopTilt() })
onUnmounted(() => { if (tiltId !== null) cancelAnimationFrame(tiltId) })
</script>

<template>
  <Teleport to="body">
    <!-- Outer: flex-column. touch-action:pan-y → permette lo scroll verticale all'area
         sottostante (con touch-action:none l'intersezione con gli antenati lo bloccava).
         Lo scroll-passthrough resta bloccato da overscroll-behavior:contain + body overflow:hidden. -->
    <div style="position:fixed;inset:0;z-index:9000;background:var(--theme-bg);backdrop-filter:blur(24px);display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;">

      <!-- Header fisso: non scorre mai -->
      <div style="flex-shrink:0;background:var(--theme-surface);backdrop-filter:blur(16px);border-bottom:1px solid var(--theme-border);padding:15px 18px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
          <span :style="{ fontFamily: FF.display, fontSize: '21px', fontWeight: 800, color: 'var(--theme-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ waifu.nome }}</span>
          <span :style="{ color: rarColor, fontSize: '17px', letterSpacing: '3px', filter: `drop-shadow(0 0 6px ${rarColor})`, flexShrink: 0 }">{{ STELLE[waifu.rarita] ?? '★' }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <!-- Preferiti: bottone tondo bordo viola, cuore con bordo visibile se deselezionato -->
          <button @click="emit('togglePreferita')"
            :style="{ width:'44px', height:'44px', borderRadius:'50%', background:'var(--theme-surface)', border:'1.5px solid var(--theme-accent)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow: pref ? `0 0 10px ${C.sakura}66` : 'none' }">
            <Heart :size="22" :fill="pref ? C.sakura : 'none'" :color="pref ? C.sakura : 'var(--theme-text-2)'" stroke-width="2" />
          </button>
          <!-- Chiudi: solo X, bottone tondo bordo viola, stessa dimensione -->
          <button @click="emit('chiudi')"
            style="width:44px;height:44px;border-radius:50%;background:var(--theme-surface);border:1.5px solid var(--theme-accent);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--theme-text-2);">
            <X :size="20" stroke-width="2.2" />
          </button>
        </div>
      </div>

      <!-- Carta: rimpicciolisce allo scroll se una sezione è espansa -->
      <div ref="cardOuter" :style="cardShrinkStyle">
        <div
          ref="cardWrap"
          @pointermove="onCardMove"
          @pointerleave="onCardLeave"
          @touchmove.passive="onCardTouch"
          @touchend.passive="onCardLeave"
          style="position:relative;display:inline-block;transform-style:preserve-3d;will-change:transform;"
          :style="{ transform: tiltTr, transition: 'transform 0.05s linear' }"
        >
          <CartaWaifu
            :waifu="waifu"
            :datiCollezione="dati"
            dimensione="grande"
            tipo="auto"
            :isHot="false"
            :censurata="false"
          />
          <!-- Chip TIPO — top-right angolo, bg pieno come i chip LV/copie -->
          <div v-if="waifuTipo" :style="{
            position: 'absolute', top: '-20px', right: '-30px', zIndex: 20,
            background: 'var(--theme-surface)', border: `2px solid ${tc(waifuTipo).border}`,
            borderRadius: '999px', padding: '8px 20px',
            fontFamily: FF.label, fontSize: '17px', fontWeight: 900,
            color: tc(waifuTipo).txt, letterSpacing: '0.12em', textTransform: 'uppercase',
            boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">⚡ {{ typeLabel(waifuTipo) }}</div>
          <!-- Chip LV — bottom-left angolo -->
          <div :style="{
            position: 'absolute', bottom: '-20px', left: '-30px', zIndex: 20,
            background: dati.levelup_pending ? 'rgba(88,224,163,0.15)' : 'var(--theme-surface)',
            border: `2px solid ${dati.levelup_pending ? C.ok : C.gold}cc`,
            borderRadius: '999px', padding: '7px 18px',
            fontFamily: FF.label, fontSize: '16px', fontWeight: 900,
            color: dati.levelup_pending ? C.ok : C.gold, letterSpacing: '0.06em',
            boxShadow: dati.levelup_pending ? `0 0 14px ${C.ok}66` : `0 2px 10px rgba(0,0,0,0.6)`,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">LV {{ lv }}</div>
          <!-- Chip copie — bottom-right angolo -->
          <div :style="{
            position: 'absolute', bottom: '-20px', right: '-30px', zIndex: 20,
            background: 'var(--theme-surface)', border: '2px solid var(--theme-border)',
            borderRadius: '999px', padding: '7px 18px',
            fontFamily: FF.label, fontSize: '16px', fontWeight: 900,
            color: 'var(--theme-text-2)', letterSpacing: '0.06em',
            boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">{{ copie }} / 3</div>
        </div>
      </div>

      <!-- Sezioni: flex:1, touch-action:pan-y permette solo scroll verticale qui -->
      <div style="flex:1;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;">
        <div style="max-width:440px;margin:0 auto;padding:8px 16px calc(24px + env(safe-area-inset-bottom));">

          <!-- Bottone GUARDA IMMERSIVA (solo carte con video) -->
          <div v-if="waifu.asset_video && videoOk" style="display:flex;justify-content:center;margin-bottom:14px;">
            <button @click="videoOpen = true; videoError = false" :style="{
              background: 'linear-gradient(135deg, rgba(255,126,182,0.22), rgba(167,139,250,0.14))',
              border: '1.5px solid rgba(255,126,182,0.6)', borderRadius: '999px', padding: '11px 28px',
              fontFamily: FF.label, fontSize: '12px', fontWeight: 800, color: '#ff7eb6',
              letterSpacing: '0.18em', cursor: 'pointer', boxShadow: '0 0 20px rgba(255,126,182,0.35)',
              textTransform: 'uppercase',
            }">▶ Guarda immersiva</button>
          </div>

          <!-- Bottone LEVEL UP — disponibile con 3+ copie (o flag pending dal server) -->
          <div v-if="dati.levelup_pending || (dati.copie ?? 0) >= 3" style="display:flex;justify-content:center;margin-bottom:14px;">
            <button @click="emit('levelUp')" :style="{
              background: `linear-gradient(135deg, rgba(88,224,163,0.22), rgba(6,214,160,0.12))`,
              border: `1.5px solid ${C.ok}88`, borderRadius: '999px', padding: '11px 28px',
              fontFamily: FF.label, fontSize: '12px', fontWeight: 800, color: C.ok,
              letterSpacing: '0.18em', cursor: 'pointer', boxShadow: `0 0 20px ${C.ok}44`,
              textTransform: 'uppercase',
            }">{{ $t('card.level_up_available') }}</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">

            <!-- ── STATISTICHE collapsible ── -->
            <div :style="{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: '14px', overflow: 'hidden' }">
              <button @click="statsOpen = !statsOpen" style="width:100%;background:none;border:none;border-radius:0 !important;box-shadow:none !important;cursor:pointer;padding:18px 18px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:17px">📊</span>
                  <span :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 800, color: C.violet, letterSpacing: '0.2em', textTransform: 'uppercase' }">{{ $t('card.statistics') }}</span>
                </div>
                <component :is="statsOpen ? ChevronUp : ChevronDown" :size="18" :color="`${C.violet}99`" stroke-width="1.5" />
              </button>
              <div v-if="statsOpen" style="padding:18px 12px 20px;">
                <div v-for="s in STAT_DEFS" :key="s.key" style="margin-bottom:16px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase' }">{{ s.icon }} {{ $t('card.stat_' + s.key) }}</span>
                    <span :style="{ fontFamily: FF.label, fontSize: '15px', color: 'var(--theme-text)', fontWeight: 700 }">{{ statVal(s.key) }}</span>
                  </div>
                  <div style="height:5px;background:var(--theme-border);border-radius:99px;overflow:hidden;">
                    <div :style="{ height: '100%', borderRadius: '99px', width: statPct(s.key, s.max) + '%', background: 'linear-gradient(90deg,#a78bfa,#ff85b6)', transition: 'width 0.65s cubic-bezier(0.25,1,0.5,1)' }" />
                  </div>
                </div>
              </div>
            </div>

            <!-- ── BATTAGLIA & MOSSE collapsible ── -->
            <div :style="{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: '14px', overflow: 'hidden' }">
              <button @click="battleOpen = !battleOpen" style="width:100%;background:none;border:none;border-radius:0 !important;box-shadow:none !important;cursor:pointer;padding:18px 18px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <Swords :size="18" :color="C.gold" stroke-width="1.5" />
                  <span :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 800, color: C.gold, letterSpacing: '0.2em', textTransform: 'uppercase' }">{{ $t('card.battle_moves') }}</span>
                  <span :style="{ fontFamily: FF.label, fontSize: '12px', color: `${C.gold}66` }">{{ Object.values(mosseSlot).filter(Boolean).length }}/4</span>
                </div>
                <component :is="battleOpen ? ChevronUp : ChevronDown" :size="18" :color="`${C.gold}88`" stroke-width="1.5" />
              </button>
              <div v-if="battleOpen" style="padding:18px 12px 20px;">
                <!-- VEL / HP / CRIT — colori tema-aware (leggibili in bright mode) -->
                <div style="display:flex;gap:10px;margin-bottom:18px;">
                  <div class="wd-stat wd-stat--vel">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">⚡</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">{{ $t('card.stat_speed_abbr') }}</div>
                    <div class="wd-stat__val wd-stat__val--vel" :style="{ fontFamily: FF.label }">{{ Math.round(vel) }}</div>
                  </div>
                  <div class="wd-stat wd-stat--hp">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">💚</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">HP</div>
                    <div class="wd-stat__val wd-stat__val--hp" :style="{ fontFamily: FF.label }">{{ Math.round(hp) }}</div>
                  </div>
                  <div class="wd-stat wd-stat--crit">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">💥</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">{{ $t('card.stat_crit_abbr') }}</div>
                    <div class="wd-stat__val wd-stat__val--crit" :style="{ fontFamily: FF.label }">{{ Math.round(crit * 100) }}%</div>
                  </div>
                </div>
                <!-- #21: One-Click — 4 mosse casuali compatibili -->
                <button @click="oneClickMosse" :style="{
                  width:'100%', marginBottom:'12px', padding:'11px', borderRadius:'11px', border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg,${C.violet},#6938e8)`, color:'#fff',
                  fontFamily:FF.label, fontSize:'13px', fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  boxShadow:`0 4px 16px ${C.violet}44`,
                }">
                  <Sparkles :size="15" stroke-width="2" /> {{ $t('card.one_click_moves') }}
                </button>
                <!-- Slot mosse -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div v-for="slot in SLOTS" :key="slot">
                    <div :style="{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', borderRadius: '11px',
                      background: 'var(--theme-shimmer)',
                      border: '1px solid var(--theme-border)',
                    }">
                      <span :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-3)', letterSpacing: '0.1em', flexShrink: 0, minWidth: '14px' }">{{ slot }}</span>
                      <div v-if="mossaInSlot(slot)" style="flex:1;min-width:0;">
                        <div :style="{ fontFamily: FF.label, fontSize: '14px', color: 'var(--theme-text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ mossaInSlot(slot)!.nome }}</div>
                        <div :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-2)', marginTop: '2px' }">
                          {{ typeLabel(mossaInSlot(slot)!.tipologia ?? mossaInSlot(slot)!.tipo) }} · {{ mossaInSlot(slot)!.rarita }} · PP:{{ mossaInSlot(slot)!.pp }} · ×{{ mossaInSlot(slot)!.danno }}
                        </div>
                      </div>
                      <div v-else style="flex:1;">
                        <span :style="{ fontFamily: FF.label, fontSize: '12px', color: 'var(--theme-text-3)', letterSpacing: '0.1em' }">{{ $t('card.empty_slot') }}</span>
                      </div>
                      <div style="display:flex;gap:5px;flex-shrink:0;">
                        <button @click="slotPicker = slot" :style="{
                          width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(174,156,255,0.1)', border: '1px solid rgba(174,156,255,0.25)',
                          borderRadius: '9px', cursor: 'pointer', color: C.violet,
                        }">
                          <component :is="mossaInSlot(slot) ? Swords : Plus" :size="15" stroke-width="1.5" />
                        </button>
                        <button v-if="mossaInSlot(slot)" @click="emit('rimuoviMossa', slot)" :style="{
                          width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.2)',
                          borderRadius: '9px', cursor: 'pointer', color: C.err,
                        }">
                          <Trash2 :size="14" stroke-width="1.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ── SLOT PICKER — bottom sheet ── -->
      <div
        v-if="slotPicker"
        @click.self="slotPicker = null"
        style="position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.55);"
      >
        <div style="position:fixed;bottom:0;left:0;right:0;max-height:72vh;background:var(--theme-surface);border-top:1px solid var(--theme-border);border-radius:20px 20px 0 0;overflow-y:auto;padding:16px 16px calc(20px + env(safe-area-inset-bottom));">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <span :style="{ fontFamily: FF.label, fontSize: '16px', color: C.violet, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }">
              SLOT {{ slotPicker }} — Scegli mossa
            </span>
            <button @click="slotPicker = null" style="background:none;border:none;cursor:pointer;color:var(--theme-text-3);padding:6px;">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <!-- Compatibili -->
          <template v-if="pickerMosse.filter(m => m.ok).length">

            <!-- Barra filtri + ordinamento -->
            <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px;">
              <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;">
                <span :style="chipLabelStyle">Ordina</span>
                <button v-for="s in SORT_OPTS" :key="s.k" @click="pickerSort = s.k" :style="chipStyle(pickerSort === s.k)">{{ s.l }}</button>
              </div>
              <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;">
                <span :style="chipLabelStyle">Effetti</span>
                <button v-for="e in EFF_OPTS" :key="e.k" @click="pickerFEff = e.k" :style="chipStyle(pickerFEff === e.k)">{{ e.l }}</button>
              </div>
              <div v-if="pickerTipi.length > 1" style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;">
                <span :style="chipLabelStyle">Tipo</span>
                <button @click="pickerFTipo = ''" :style="chipStyle(pickerFTipo === '')">Tutti</button>
                <button v-for="tp in pickerTipi" :key="tp" @click="pickerFTipo = pickerFTipo === tp ? '' : tp" :style="chipStyle(pickerFTipo === tp, tc(tp).border)">{{ typeLabel(tp) || tp }}</button>
              </div>
            </div>

            <div :style="{ fontFamily: FF.label, fontSize: '12px', color: C.ok, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }">
              ✓ COMPATIBILI ({{ pickerCompatibili.length }})
            </div>
            <!-- #20: carta mossa COMPLETA (effetti visibili) — click per assegnare.
                 3 colonne (card più piccole, più spazio) come la collezione. -->
            <div v-if="pickerCompatibili.length" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 12px;margin-bottom:20px;">
              <div
                v-for="m in pickerCompatibili"
                :key="m.id"
                @click="emit('assegnaMossa', slotPicker!, m.id); slotPicker = null"
                style="cursor:pointer;position:relative;"
              >
                <MoveCard :move="toMoveCard(m.cat) as any" :owned="true" />
                <div :style="{ position:'absolute', bottom:'4px', left:'50%', transform:'translateX(-50%)', background: tc(m.cat.tipologia ?? m.cat.tipo).border, color:'#fff', borderRadius:'999px', padding:'2px 8px', fontFamily: FF.label, fontSize:'8px', fontWeight:800, letterSpacing:'0.08em', pointerEvents:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.4)' }">+ {{ slotPicker }}</div>
              </div>
            </div>
            <!-- Nessun risultato coi filtri correnti -->
            <div v-else :style="{ fontFamily: FF.body, fontSize: '12px', color: 'var(--theme-text-3)', textAlign: 'center', padding: '18px 0 24px' }">
              Nessuna mossa con questi filtri
            </div>
          </template>

          <!-- Non compatibili — collassabile -->
          <template v-if="pickerMosse.filter(m => !m.ok).length">
            <button
              @click="nonCompatOpen = !nonCompatOpen"
              style="width:100%;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:10px 0;margin-bottom:8px;"
            >
              <span :style="{ fontFamily: FF.label, fontSize: '12px', color: C.err, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }">
                ✗ NON COMPATIBILI ({{ pickerMosse.filter(m => !m.ok).length }})
              </span>
              <component :is="nonCompatOpen ? ChevronUp : ChevronDown" :size="16" :color="C.err" stroke-width="2" />
            </button>
            <div v-if="nonCompatOpen" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div
                v-for="m in pickerMosse.filter(x => !x.ok)"
                :key="m.id"
                style="padding:12px 14px 12px 22px;background:var(--theme-shimmer);border:1px solid var(--theme-border);border-radius:10px;opacity:0.65;min-width:0;"
              >
                <div :style="{ fontFamily: FF.label, fontSize: '14px', color: 'var(--theme-text)', fontWeight: 700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">{{ m.cat.nome }}</div>
                <div :style="{ fontFamily: FF.label, fontSize: '14px', color: C.err, marginTop: '4px', fontWeight: 600 }">{{ m.motivo }}</div>
              </div>
            </div>
          </template>

          <!-- Empty -->
          <div v-if="!pickerMosse.length" style="text-align:center;padding:36px 0;color:var(--theme-text-3);">
            <Swords :size="32" stroke-width="1" style="margin:0 auto 10px;" />
            <div :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.2em' }">{{ $t('card.no_moves_collection') }}</div>
          </div>

        </div>
      </div>

    </div>

  <!-- Overlay VIDEO IMMERSIVA -->
  <div v-if="videoOpen" @click="videoOpen = false"
    style="position:fixed;inset:0;z-index:99995;background:rgba(4,2,14,0.9);backdrop-filter:blur(10px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;">
    <video v-if="!videoError" :src="waifu.asset_video" autoplay playsinline controls loop
      @click.stop
      @error="videoError = true"
      style="max-width:100%;max-height:78dvh;border-radius:16px;box-shadow:0 0 60px rgba(255,126,182,0.35);" />
    <div v-else :style="{ fontFamily: FF.body, fontSize: '14px', color: 'var(--theme-text-2)', textAlign: 'center', padding: '30px 20px' }">
      🎬 Video immersivo in arrivo…
    </div>
    <button @click="videoOpen = false" :style="{
      background: 'none', border: '1px solid var(--theme-border)', borderRadius: '999px',
      color: 'var(--theme-text-2)', fontFamily: FF.label, fontSize: '11px',
      padding: '10px 26px', cursor: 'pointer', letterSpacing: '0.2em', textTransform: 'uppercase',
    }">Chiudi</button>
  </div>
  </Teleport>
</template>

<style scoped>
/* Box statistica VEL / HP / CRIT */
.wd-stat {
  flex: 1;
  text-align: center;
  padding: 12px 4px;
  border-radius: 12px !important;
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
}
.wd-stat__label {
  font-size: 10px;
  letter-spacing: 0.2em;
  margin-bottom: 4px;
  color: var(--text-secondary);
}
.wd-stat__val {
  font-size: 22px;
  font-weight: 800;
}
/* Light mode: tinte scure sature → leggibili su sfondo chiaro */
.wd-stat__val--vel  { color: #0e8aa3; }
.wd-stat__val--hp   { color: #15a34a; }
.wd-stat__val--crit { color: #d97706; }
.wd-stat--vel  { border-color: rgba(14,138,163,0.25); }
.wd-stat--hp   { border-color: rgba(21,163,74,0.25); }
.wd-stat--crit { border-color: rgba(217,119,6,0.25); }
/* Dark mode: tinte brillanti originali su sfondo scuro */
[data-theme="dark"] .wd-stat__val--vel  { color: #6cf0e0; }
[data-theme="dark"] .wd-stat__val--hp   { color: #58e0a3; }
[data-theme="dark"] .wd-stat__val--crit { color: #fbbf24; }
</style>
