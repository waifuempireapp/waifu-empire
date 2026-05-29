<script setup lang="ts">
/**
 * PickPhase.vue — Schermata di draft segreto "3-from-roster" che precede il caricamento
 * di WaifuBattleArena. Ogni giocatore sceglie 3 waifu dal proprio roster (da 5)
 * senza vedere le scelte dell'avversario.
 *
 * Modalità supportate:
 *   - CPU        : il giocatore sceglie 3 waifu; la CPU pesca (per rarità) al mount.
 *   - PvP Online : ogni giocatore sceglie sul proprio dispositivo;
 *                  la sync avviene via Firestore (gestita dal parent MappaMultiplayer).
 *
 * Il componente produce anche il named export RevealScreen (componente figlio separato),
 * importato dal parent tramite <PickPhaseRevealScreen>.
 */

import {
  TYPE_COLORS,
  initBattleWaifu,
  computeSpeed,
  computeCritChance,
} from '~/utils/battleEngine'
import { ikUrl } from '~/utils/imagekitUrl'

// ─────────────────────────────────────────────────────────────────────────────
// TIPI LOCALI
// ─────────────────────────────────────────────────────────────────────────────

/** Documento waifu Firestore con campi di battaglia opzionali */
interface WaifuDoc {
  id?: string
  nome?: string
  name?: string
  rarità?: string
  rarita?: string
  rarity?: string
  asset_statica?: string
  img?: string
  imgUrl?: string
  image?: string
  speed?: number
  velocita?: number
  velocita_base?: number
  critChance?: number
  crit_chance?: number
  crit_chance_base?: number
  livello?: number
  hp?: number
  mosse_slot?: unknown
  _mosseData?: unknown
  _battleStats?: Record<string, unknown>
  battleStats?: Record<string, unknown>
  _hotBlurred?: boolean
  _cpuMoves?: Array<Record<string, unknown>>
  moves?: Array<Record<string, unknown>>
  [key: string]: unknown
}

/** Waifu pronta per la battaglia (output di initBattleWaifu) */
interface WaifuBattleStat extends WaifuDoc {
  moves: Array<Record<string, unknown>>
}

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI DI LOGICA
// ─────────────────────────────────────────────────────────────────────────────

/** Numero di waifu che il giocatore deve selezionare per confermare il team. */
const PICKS_RICHIESTI = 3

/** Numero minimo di waifu nel roster per accedere alla pick phase. */
const ROSTER_MIN = 5

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI RARITÀ — colori e gradienti per ciascuna rarità
// ─────────────────────────────────────────────────────────────────────────────

/** Colori e sfondi per ciascuna rarità waifu. */
const RARITY_STYLE: Record<string, { badge: string; glow: string; cardBg: string }> = {
  immersivo:   { badge: '#ff7eb6', glow: 'rgba(255,126,182,0.35)', cardBg: 'linear-gradient(160deg, rgba(127,24,112,0.28), rgba(6,3,15,.75))' },
  leggendario: { badge: '#ffc861', glow: 'rgba(255,200,97,0.35)',  cardBg: 'linear-gradient(160deg, rgba(74,49,5,0.28),   rgba(6,3,15,.75))' },
  epico:       { badge: '#b573ff', glow: 'rgba(181,115,255,0.35)', cardBg: 'linear-gradient(160deg, rgba(42,18,85,0.28),  rgba(6,3,15,.75))' },
  raro:        { badge: '#5aa9ff', glow: 'rgba(90,169,255,0.35)',  cardBg: 'linear-gradient(160deg, rgba(20,42,85,0.28),  rgba(6,3,15,.75))' },
  comune:      { badge: '#b4bcc8', glow: 'rgba(180,188,200,0.2)',  cardBg: 'rgba(6,3,15,.6)' },
}

/** Restituisce le costanti di stile per una rarità, con fallback su 'comune'. */
function getRarityStyle(rarita?: string) {
  return RARITY_STYLE[(rarita ?? '').toLowerCase()] ?? RARITY_STYLE.comune
}

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI STILI CONDIVISI (S) — DRY, SRP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stili condivisi del componente PickPhase.
 * Definiti fuori dal setup perché non dipendono da props o state.
 */
const C = {
  root: (topOffset = 0, bottomOffset = 0): Record<string, unknown> => ({
    position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, bottom: `${bottomOffset}px`, zIndex: 40,
    background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }),
  header: {
    flexShrink: 0,
    padding: '10px 14px 8px',
    borderBottom: '1px solid rgba(255,255,255,.07)',
    background: 'rgba(6,3,15,.55)',
  } as Record<string, unknown>,
  body: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px', WebkitOverflowScrolling: 'touch',
  } as Record<string, unknown>,
  section: { marginBottom: '16px' } as Record<string, unknown>,
  label: {
    fontFamily: 'Orbitron', fontSize: '8px', letterSpacing: '2px',
    color: 'rgba(238,232,220,.4)', marginBottom: '6px',
  } as Record<string, unknown>,
  confirmBtn: (active: boolean): Record<string, unknown> => ({
    width: '100%', padding: '14px 0', marginTop: '10px',
    background: active ? 'linear-gradient(135deg,#00e676,#00b050)' : 'rgba(255,255,255,.06)',
    border: active ? 'none' : '1px solid rgba(255,255,255,.1)',
    borderRadius: '12px', cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.45,
    fontFamily: 'Orbitron', fontSize: '12px', fontWeight: 700,
    color: active ? '#000' : 'rgba(238,232,220,.4)', letterSpacing: '2px',
  }),
}

// Alias per retro-compatibilità con il sorgente React (FF non usato nel template,
// ma definito per chiarezza durante la migrazione)
const FF = {
  Orbitron: 'Orbitron,monospace',
  Fredoka: 'Fredoka,sans-serif',
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Fino a 5 documenti Firestore delle waifu del giocatore */
  roster5P?: WaifuDoc[]
  /** Fino a 5 documenti Firestore delle waifu dell'avversario/CPU */
  roster5E?: WaifuDoc[]
  /** True quando il giocatore combatte contro la CPU */
  isCpu?: boolean
  /** True in modalità PvP online (dispositivi separati, sync via Firestore) */
  isPvP?: boolean
  /** Indici di roster5E sempre inclusi nel team CPU (es. [0] per la Waifu Raid) */
  forcedEnemyIndices?: number[]
  /** Contesto battaglia: { terrSel, nomeImperoAvversario } */
  battleCtx?: { terrSel?: { nome?: string }; nomeImperoAvversario?: string }
}>(), {
  roster5P: () => [],
  roster5E: () => [],
  isCpu: true,
  isPvP: false,
  forcedEnemyIndices: () => [],
  battleCtx: () => ({}),
})

// ─────────────────────────────────────────────────────────────────────────────
// EMITS
// ─────────────────────────────────────────────────────────────────────────────

/** confirm: emesso quando entrambi i team sono pronti per la battaglia */
const emit = defineEmits<{
  confirm: [{ playerPick3: WaifuBattleStat[]; enemyPick3: WaifuBattleStat[] }]
}>()

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL LOCK — blocca lo scroll del body mentre la pick phase è attiva
// ─────────────────────────────────────────────────────────────────────────────
useScrollLock(true)

// ─────────────────────────────────────────────────────────────────────────────
// STATO: step della pick phase
// 'picking' = selezione in corso | 'reveal' = rivelazione starter (CPU)
// ─────────────────────────────────────────────────────────────────────────────
const pvpStep = ref<'picking' | 'reveal'>('picking')

// ─────────────────────────────────────────────────────────────────────────────
// STATO: offset top/bottom per non sovrapporsi a header e bottom nav
// ─────────────────────────────────────────────────────────────────────────────
const topOffset    = ref(0)
const bottomOffset = ref(0)

function calcOffset() {
  if (!import.meta.client) return
  const hdr   = document.querySelector('.hdr-root')
  const ntabs = document.querySelector('.ntabs-root')
  const bnav  = document.querySelector('.bottom-nav-mobile')
  topOffset.value = (hdr   ? (hdr   as HTMLElement).getBoundingClientRect().height : 0)
                  + (ntabs ? (ntabs as HTMLElement).getBoundingClientRect().height : 0)
  bottomOffset.value = bnav ? (bnav as HTMLElement).getBoundingClientRect().height : 0
}

onMounted(() => {
  calcOffset()
  window.addEventListener('resize', calcOffset)
})

onUnmounted(() => {
  window.removeEventListener('resize', calcOffset)
  if (revealTimerId.value) clearTimeout(revealTimerId.value)
})

// ─────────────────────────────────────────────────────────────────────────────
// CPU PICK — la CPU pesca PICKS_RICHIESTI waifu al mount (per rarità desc)
// forcedEnemyIndices: indici sempre inclusi (es. Waifu Raid)
// ─────────────────────────────────────────────────────────────────────────────
const RARITY_SCORE: Record<string, number> = {
  immersivo: 5, leggendario: 4, epico: 3, raro: 2, comune: 1,
}

const cpuPicks = computed<WaifuDoc[]>(() => {
  const forced      = props.forcedEnemyIndices.filter(i => i >= 0 && i < props.roster5E.length)
  const forcedWaifu = forced.map(i => props.roster5E[i]).filter(Boolean) as WaifuDoc[]
  const others      = props.roster5E.filter((_, i) => !forced.includes(i))
  const sortedOthers = [...others].sort((a, b) =>
    (RARITY_SCORE[(b?.rarita as string) ?? ''] ?? 1) - (RARITY_SCORE[(a?.rarita as string) ?? ''] ?? 1),
  )
  return [...forcedWaifu, ...sortedOthers].slice(0, PICKS_RICHIESTI).filter(Boolean) as WaifuDoc[]
})

// ─────────────────────────────────────────────────────────────────────────────
// STATO: selezioni del giocatore (array di indici in roster5P)
// ─────────────────────────────────────────────────────────────────────────────
const p1Slots = ref<number[]>([])

// Timer reveal (cleanup al unmount)
const revealTimerId = ref<ReturnType<typeof setTimeout> | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// LOGICA: tap su una card del roster
// ─────────────────────────────────────────────────────────────────────────────
function handleTapRoster(idx: number) {
  const pos = p1Slots.value.indexOf(idx)
  if (pos !== -1) {
    // Deseleziona mantenendo l'ordine degli altri
    p1Slots.value = p1Slots.value.filter((_, i) => i !== pos)
  } else if (p1Slots.value.length < PICKS_RICHIESTI) {
    p1Slots.value = [...p1Slots.value, idx]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGICA: costruzione del team WaifuBattleStat dagli indici selezionati
// ─────────────────────────────────────────────────────────────────────────────
function buildTeam(roster: WaifuDoc[], picks: number[]): WaifuBattleStat[] {
  return picks.map(idx => {
    const w = roster[idx]
    if (!w) return null
    // Se ha già speed + moves battle-ready, usarla direttamente
    if (w.speed !== undefined && (w.moves as unknown[])?.length) return { ...w } as WaifuBattleStat
    // Passa i dati collezione incluso _mosseData per usare le mosse dal DB
    const collectionData = {
      livello:      w.livello    ?? 1,
      velocita:     w.velocita   ?? null,
      crit_chance:  w.crit_chance ?? null,
      hp:           w.hp         ?? null,
      mosse_slot:   w.mosse_slot ?? null,
      _mosseData:   w._mosseData ?? null,
    }
    return initBattleWaifu(w as Record<string, unknown>, collectionData) as WaifuBattleStat
  }).filter(Boolean) as WaifuBattleStat[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: conferma del giocatore
// ─────────────────────────────────────────────────────────────────────────────
function handleP1Confirm() {
  if (p1Slots.value.length < PICKS_RICHIESTI) return
  const playerTeam = buildTeam(props.roster5P, p1Slots.value)

  if (props.isPvP) {
    // PvP Online: il team avversario arriva via Firestore dal parent
    emit('confirm', { playerPick3: playerTeam, enemyPick3: [] })
  } else {
    // Modalità CPU: costruisce il team nemico con mosse da catalogo
    const enemyTeam: WaifuBattleStat[] = cpuPicks.value.map(w => {
      const cpuMoves = w._cpuMoves ?? null
      const waifu = initBattleWaifu(w as Record<string, unknown>, { livello: (w.livello as number) ?? 1 }) as WaifuBattleStat
      if (cpuMoves?.length) {
        return {
          ...waifu,
          moves: cpuMoves.map(m => ({ ...m, pp: (m.maxPp as number) ?? (m.pp as number) ?? 5 })),
        }
      }
      return waifu
    })
    emit('confirm', { playerPick3: playerTeam, enemyPick3: enemyTeam })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED: dati di render per lo step picking
// ─────────────────────────────────────────────────────────────────────────────
const activeRoster   = computed(() => props.roster5P)
const activeSlots    = computed(() => p1Slots.value)
const opponentRoster = computed(() => props.roster5E)
const opponentLabel  = computed(() => props.battleCtx?.nomeImperoAvversario ?? 'CPU')
const terrSel        = computed(() => props.battleCtx?.terrSel)

// Controllo: starter per la reveal interna (step 'reveal')
const p1ActiveStarter  = computed(() => props.roster5P[p1Slots.value[0]])
const cpuActiveStarter = computed(() => cpuPicks.value[0])

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY DI RENDERING
// ─────────────────────────────────────────────────────────────────────────────

/** Restituisce il numero dello slot (1-based) di una card, o null se non selezionata */
function getSlotNumber(idx: number): number | null {
  const pos = p1Slots.value.indexOf(idx)
  return pos !== -1 ? pos + 1 : null
}

/** Restituisce l'URL immagine della waifu usando ikUrl */
function getWaifuImgUrl(w: WaifuDoc): string | null {
  return ikUrl(
    (w.asset_statica ?? w.img ?? w.imgUrl ?? w.image ?? null) as string | null,
    'card',
  )
}

/** Restituisce i battleStats normalizzati della waifu */
function getBattleStats(w: WaifuDoc): Record<string, unknown> {
  return (w._battleStats ?? w.battleStats ?? {}) as Record<string, unknown>
}

/** Calcola la rarità normalizzata (lowercase) per i lookup di stile */
function getWaifuRarita(w: WaifuDoc): string {
  return (w.rarità ?? w.rarita ?? w.rarity ?? 'Comune') as string
}

/** Stile del bordo della card in base a selezione e rarità */
function cardBorderColor(isSelected: boolean, rs: ReturnType<typeof getRarityStyle>): string {
  return isSelected ? '#00e676' : `${rs.badge}55`
}

/** Stile background della card */
function cardBackground(isSelected: boolean, rs: ReturnType<typeof getRarityStyle>): string {
  return isSelected ? 'rgba(0,230,118,.08)' : rs.cardBg
}

/** Stile box-shadow per rarità alte */
function cardBoxShadow(rarita: string, rs: ReturnType<typeof getRarityStyle>): string {
  return ['epico', 'leggendario', 'immersivo'].includes(rarita.toLowerCase())
    ? `0 0 8px ${rs.glow}`
    : 'none'
}

/** Colore del bordo per il tipo elemento */
function getTypeColor(type?: string): string {
  return (TYPE_COLORS[(type ?? 'Arcana')] as { border?: string })?.border ?? '#444'
}

/** Colori del badge tipo elemento */
function getTypeBadgeStyle(type?: string): Record<string, unknown> {
  const c = (TYPE_COLORS[(type ?? 'Arcana')] ?? { border: '#555', bg: '#111' }) as { border: string; bg: string }
  return {
    background: `${c.bg}cc`, color: c.border,
    border: `1px solid ${c.border}88`,
    borderRadius: '4px', padding: '1px 6px', fontSize: '8px',
    fontWeight: 700, fontFamily: 'Orbitron,monospace',
    letterSpacing: '0.5px', display: 'inline-block', whiteSpace: 'nowrap',
  }
}

/** Percentuale HP e colore barra */
function hpBarData(hp: number, maxHp: number) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const col = pct > 50 ? '#00e676' : pct > 25 ? '#ffd666' : '#ff4d4d'
  return { pct, col }
}
</script>

<template>
  <!-- ─────────────────────────────────────────────────────────────────
       GUARD: roster insufficiente
       Il giocatore ha meno di ROSTER_MIN waifu → errore + blocco draft.
       ───────────────────────────────────────────────────────────────── -->
  <div v-if="roster5P.length < ROSTER_MIN" :style="C.root(topOffset, bottomOffset)">
    <div :style="{ ...C.header, textAlign: 'center' }">
      <div style="font-family:Orbitron;font-size:13px;font-weight:700;color:#ff4d4d;letter-spacing:2px">
        ⚠ WAIFU INSUFFICIENTI
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
      <div>
        <div style="font-size:40px;margin-bottom:16px">😔</div>
        <div style="font-family:Fredoka;font-size:14px;color:#eedcd4;line-height:1.6">
          Hai bisogno di almeno {{ ROSTER_MIN }} waifu per partecipare alla pick phase.
        </div>
        <div style="font-family:Orbitron;font-size:9px;color:rgba(238,232,220,.4);margin-top:8px;letter-spacing:1px">
          Apri bustine nella sezione Sbusta per ottenerne di più.
        </div>
      </div>
    </div>
  </div>

  <!-- ─────────────────────────────────────────────────────────────────
       STEP: reveal / cpuReveal
       Schermata di rivelazione interna degli starter prima dell'arena.
       ───────────────────────────────────────────────────────────────── -->
  <div
    v-else-if="pvpStep === 'reveal'"
    :style="{ ...C.root(topOffset, bottomOffset), alignItems: 'center', justifyContent: 'center' }"
  >
    <div
      v-if="terrSel"
      style="font-family:Orbitron;font-size:9px;color:#f5a623;letter-spacing:2px;margin-bottom:12px"
    >
      ⚔ {{ terrSel.nome }}
    </div>
    <div style="font-family:Orbitron;font-size:16px;font-weight:700;color:#eedcd4;letter-spacing:3px;margin-bottom:20px;text-align:center">
      RIVELAZIONE!
    </div>

    <div style="display:flex;gap:24px;align-items:flex-end;justify-content:center">
      <!-- Starter del giocatore -->
      <div style="text-align:center">
        <div style="font-family:Orbitron;font-size:8px;color:#00C8FF;letter-spacing:2px;margin-bottom:6px">TU</div>
        <div style="width:90px;height:135px;border-radius:10px;overflow:hidden;border:2px solid rgba(0,200,255,.4);background:rgba(6,3,15,.8)">
          <img
            v-if="p1ActiveStarter?.asset_statica"
            :src="ikUrl(p1ActiveStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="p1ActiveStarter?.nome ?? ''"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;opacity:.2">◈</div>
        </div>
        <div style="font-family:Orbitron;font-size:9px;color:#eedcd4;margin-top:6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ p1ActiveStarter?.nome ?? '—' }}
        </div>
        <!-- TypeBadge inline -->
        <span :style="getTypeBadgeStyle((getBattleStats(p1ActiveStarter ?? {}).type as string) ?? 'Arcana')">
          {{ (getBattleStats(p1ActiveStarter ?? {}).type as string) ?? 'Arcana' }}
        </span>
      </div>

      <div style="font-family:Orbitron;font-size:22px;font-weight:900;color:#ff2d78;margin-bottom:30px">VS</div>

      <!-- Starter avversario/CPU -->
      <div style="text-align:center">
        <div style="font-family:Orbitron;font-size:8px;color:#FF3355;letter-spacing:2px;margin-bottom:6px">
          {{ opponentLabel }}
        </div>
        <div style="width:90px;height:135px;border-radius:10px;overflow:hidden;border:2px solid rgba(255,50,80,.4);background:rgba(6,3,15,.8)">
          <img
            v-if="cpuActiveStarter?.asset_statica"
            :src="ikUrl(cpuActiveStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="cpuActiveStarter?.nome ?? ''"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;opacity:.2">◈</div>
        </div>
        <div style="font-family:Orbitron;font-size:9px;color:#eedcd4;margin-top:6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ cpuActiveStarter?.nome ?? '—' }}
        </div>
        <!-- TypeBadge inline -->
        <span :style="getTypeBadgeStyle((getBattleStats(cpuActiveStarter ?? {}).type as string) ?? 'Arcana')">
          {{ (getBattleStats(cpuActiveStarter ?? {}).type as string) ?? 'Arcana' }}
        </span>
      </div>
    </div>

    <div style="font-family:Fredoka;font-size:11px;color:rgba(238,232,220,.4);margin-top:20px">
      La battaglia sta per cominciare…
    </div>
  </div>

  <!-- ─────────────────────────────────────────────────────────────────
       STEP PRINCIPALE: picking
       Un solo giocatore per dispositivo. Ogni giocatore vede il proprio
       roster (selezionabile) e quello dell'avversario (sola lettura).
       ───────────────────────────────────────────────────────────────── -->
  <div v-else :style="C.root(topOffset, bottomOffset)">

    <!-- ── Header fisso ─────────────────────────────────────────────── -->
    <div :style="C.header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-family:Orbitron;font-size:11px;font-weight:700;color:#f5a623;letter-spacing:2px">
            ⚔ SCELTA TEAM
          </div>
          <div
            v-if="terrSel"
            style="font-family:Orbitron;font-size:8px;color:rgba(238,232,220,.4);margin-top:2px;letter-spacing:1px"
          >
            {{ terrSel.nome }} · {{ opponentLabel }}
          </div>
        </div>
        <!-- Badge "TU" — giocatore corrente su questo dispositivo -->
        <div style="font-family:Orbitron;font-size:10px;font-weight:700;color:#00C8FF;background:rgba(0,200,255,.10);border:1px solid rgba(0,200,255,.3);border-radius:8px;padding:4px 10px">
          TU
        </div>
      </div>
      <!-- Istruzione + contatore selezioni -->
      <div style="font-family:Fredoka;font-size:11px;color:rgba(238,232,220,.5);margin-top:6px">
        Scegli {{ PICKS_RICHIESTI }} waifu strategicamente in base ai
        <span style="color:#a78bfa">tipi</span> delle tue waifu e di quelle che l'avversario potrebbe schierare.
        La prima scelta entra subito in campo.<br/>
        <span style="color:#00e676;font-weight:700">{{ activeSlots.length }}/{{ PICKS_RICHIESTI }} selezionate</span>
      </div>
    </div>

    <!-- ── Body scrollabile ─────────────────────────────────────────── -->
    <div :style="C.body">

      <!-- Sezione: roster del giocatore (selezionabile) -->
      <div :style="C.section">
        <div :style="C.label">IL TUO ROSTER</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          <template v-for="(w, idx) in activeRoster" :key="w.id ?? idx">
            <button
              :style="{
                border: `2px solid ${cardBorderColor(getSlotNumber(idx) !== null, getRarityStyle(getWaifuRarita(w)))}`,
                borderRadius: '12px',
                background: cardBackground(getSlotNumber(idx) !== null, getRarityStyle(getWaifuRarita(w))),
                padding: '8px 10px',
                cursor: 'pointer',
                position: 'relative',
                textAlign: 'left',
                width: '100%',
                transition: 'border-color .15s, background .15s',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: cardBoxShadow(getWaifuRarita(w), getRarityStyle(getWaifuRarita(w))),
              }"
              @click="handleTapRoster(idx)"
            >
              <!-- Badge slot numerico -->
              <div
                v-if="getSlotNumber(idx) !== null"
                style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#00e676,#00b050);display:flex;align-items:center;justify-content:center;font-family:Orbitron;font-size:10px;font-weight:900;color:#000;border:2px solid rgba(0,230,118,.6)"
              >
                {{ getSlotNumber(idx) }}
              </div>

              <!-- Card layout: thumbnail + info -->
              <div style="display:flex;gap:8px;align-items:flex-start">

                <!-- Thumbnail -->
                <div
                  :style="{
                    width: '52px', height: '78px', borderRadius: '8px', overflow: 'hidden',
                    background: 'rgba(255,255,255,.04)', flexShrink: 0,
                    border: `1.5px solid ${getRarityStyle(getWaifuRarita(w)).badge}66`,
                    position: 'relative',
                  }"
                >
                  <template v-if="getWaifuImgUrl(w)">
                    <img
                      :src="getWaifuImgUrl(w) ?? ''"
                      :alt="(w.nome ?? w.name ?? '') as string"
                      :style="{
                        width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top',
                        filter: w._hotBlurred ? 'blur(5px)' : 'none',
                      }"
                    />
                    <!-- Overlay HOT oscurata -->
                    <div
                      v-if="w._hotBlurred"
                      style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(3,2,12,0.35)"
                    >
                      <span style="font-size:14px">🔥</span>
                      <span style="font-family:Orbitron;font-size:7px;color:#ff85b6;letter-spacing:.5px;text-align:center;font-weight:700">HOT</span>
                      <span style="font-family:Orbitron;font-size:6px;color:rgba(255,133,182,0.7);text-align:center">Pass Hard</span>
                    </div>
                  </template>
                  <div
                    v-else
                    :style="{
                      display:'flex',alignItems:'center',justifyContent:'center',
                      height:'100%',fontSize:'20px',
                      color: getRarityStyle(getWaifuRarita(w)).badge, opacity: 0.3,
                    }"
                  >◈</div>

                  <!-- Pill rarità sovrapposto in basso -->
                  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:8px 4px 3px;text-align:center">
                    <span :style="{
                      fontFamily:'Orbitron',fontSize:'6px',fontWeight:900,
                      color:getRarityStyle(getWaifuRarita(w)).badge,
                      letterSpacing:'.5px',
                      textShadow:`0 0 6px ${getRarityStyle(getWaifuRarita(w)).glow}`,
                    }">{{ getWaifuRarita(w).toUpperCase() }}</span>
                  </div>
                </div>

                <!-- Info testo -->
                <div style="flex:1;min-width:0">
                  <!-- Nome -->
                  <div style="font-family:Orbitron;font-size:10px;font-weight:700;color:#eedcd4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {{ w.nome ?? w.name ?? '—' }}
                  </div>
                  <!-- Tipo badge -->
                  <div style="display:flex;gap:4px;align-items:center;margin-top:4px;flex-wrap:wrap">
                    <span :style="getTypeBadgeStyle((getBattleStats(w).type as string) ?? 'Arcana')">
                      {{ (getBattleStats(w).type as string) ?? 'Arcana' }}
                    </span>
                  </div>
                  <!-- Statistiche (roster giocatore: sempre visibili) -->
                  <div style="font-family:Orbitron;font-size:8px;color:rgba(238,232,220,.5);margin-top:4px">
                    HP: {{ (getBattleStats(w).maxHp as number) ?? 300 }}
                  </div>
                  <div style="font-family:Orbitron;font-size:7px;color:rgba(238,232,220,.55);margin-top:2px">
                    <span style="color:#00C8FF">
                      ⚡ {{ Math.round((w.speed ?? w.velocita ?? w.velocita_base ?? computeSpeed(w as Record<string,unknown>)) as number) }}
                    </span>
                    &nbsp;&nbsp;
                    <span style="color:#f5a623">
                      💥 {{ Math.round(((w.critChance ?? w.crit_chance ?? w.crit_chance_base ?? computeCritChance(w as Record<string,unknown>)) as number) * 100) }}%
                    </span>
                  </div>
                  <!-- MiniHpBar inline -->
                  <div style="height:4px;background:rgba(0,0,0,.4);border-radius:4px;overflow:hidden;margin-top:3px">
                    <div
                      :style="{
                        width: `${hpBarData((getBattleStats(w).maxHp as number) ?? 300, (getBattleStats(w).maxHp as number) ?? 300).pct}%`,
                        height:'100%',
                        background: hpBarData((getBattleStats(w).maxHp as number) ?? 300, (getBattleStats(w).maxHp as number) ?? 300).col,
                        borderRadius:'4px',
                      }"
                    />
                  </div>
                </div>
              </div>
            </button>
          </template>
        </div>
      </div>

      <!-- Sezione: roster avversario (sola lettura, statistiche nascoste) -->
      <div :style="C.section">
        <div :style="C.label">ROSTER AVVERSARIO — {{ opponentLabel }}</div>

        <!-- Avviso waifu hot oscurate -->
        <div
          v-if="opponentRoster.some(w => w._hotBlurred)"
          style="margin-bottom:8px;padding:8px 12px;background:rgba(255,133,182,0.08);border:1px solid rgba(255,133,182,0.25);border-radius:10px;font-family:Fredoka;font-size:11px;color:rgba(255,133,182,0.85);line-height:1.5"
        >
          🔥 Alcune waifu di <strong>{{ opponentLabel }}</strong> sono Hot e non puoi vederle.
          Acquista il Pass Hard per scoprirle e vederle senza censura.
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          <template v-for="(w, idx) in opponentRoster" :key="w.id ?? idx">
            <!-- Card avversario: non selezionabile, stats nascoste -->
            <div
              :style="{
                border: `2px solid ${getRarityStyle(getWaifuRarita(w)).badge}55`,
                borderRadius: '12px',
                background: getRarityStyle(getWaifuRarita(w)).cardBg,
                padding: '8px 10px',
                cursor: 'default',
                position: 'relative',
                textAlign: 'left',
                width: '100%',
                boxShadow: cardBoxShadow(getWaifuRarita(w), getRarityStyle(getWaifuRarita(w))),
              }"
            >
              <div style="display:flex;gap:8px;align-items:flex-start">
                <!-- Thumbnail avversario -->
                <div
                  :style="{
                    width: '52px', height: '78px', borderRadius: '8px', overflow: 'hidden',
                    background: 'rgba(255,255,255,.04)', flexShrink: 0,
                    border: `1.5px solid ${getRarityStyle(getWaifuRarita(w)).badge}66`,
                    position: 'relative',
                  }"
                >
                  <template v-if="getWaifuImgUrl(w)">
                    <img
                      :src="getWaifuImgUrl(w) ?? ''"
                      :alt="(w.nome ?? w.name ?? '') as string"
                      :style="{
                        width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top',
                        filter: w._hotBlurred ? 'blur(5px)' : 'none',
                      }"
                    />
                    <div
                      v-if="w._hotBlurred"
                      style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(3,2,12,0.35)"
                    >
                      <span style="font-size:14px">🔥</span>
                      <span style="font-family:Orbitron;font-size:7px;color:#ff85b6;letter-spacing:.5px;text-align:center;font-weight:700">HOT</span>
                      <span style="font-family:Orbitron;font-size:6px;color:rgba(255,133,182,0.7);text-align:center">Pass Hard</span>
                    </div>
                  </template>
                  <div
                    v-else
                    :style="{
                      display:'flex',alignItems:'center',justifyContent:'center',
                      height:'100%',fontSize:'20px',
                      color: getRarityStyle(getWaifuRarita(w)).badge, opacity: 0.3,
                    }"
                  >◈</div>

                  <!-- Pill rarità -->
                  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:8px 4px 3px;text-align:center">
                    <span :style="{
                      fontFamily:'Orbitron',fontSize:'6px',fontWeight:900,
                      color:getRarityStyle(getWaifuRarita(w)).badge,
                      letterSpacing:'.5px',
                      textShadow:`0 0 6px ${getRarityStyle(getWaifuRarita(w)).glow}`,
                    }">{{ getWaifuRarita(w).toUpperCase() }}</span>
                  </div>
                </div>

                <!-- Info testo (solo nome e tipo — stats nascoste per segretezza) -->
                <div style="flex:1;min-width:0">
                  <div style="font-family:Orbitron;font-size:10px;font-weight:700;color:#eedcd4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {{ w.nome ?? w.name ?? '—' }}
                  </div>
                  <div style="display:flex;gap:4px;align-items:center;margin-top:4px;flex-wrap:wrap">
                    <span :style="getTypeBadgeStyle((getBattleStats(w).type as string) ?? 'Arcana')">
                      {{ (getBattleStats(w).type as string) ?? 'Arcana' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Nota CPU -->
        <div
          v-if="isCpu"
          style="font-family:Fredoka;font-size:10px;color:rgba(238,232,220,.35);margin-top:6px;text-align:center"
        >
          La CPU ha già scelto il suo team — vedrai quale solo all'inizio della battaglia.
        </div>
      </div>

      <!-- ── Bottone CONFERMA sticky in fondo al body scrollabile ──────
           Sticky dentro il contenitore scroll: più affidabile di un
           footer esterno su iOS Safari e Android con gesture bar.
           ─────────────────────────────────────────────────────────── -->
      <div style="position:sticky;bottom:0;padding:10px 0 12px;background:rgba(6,3,15,.96);border-top:1px solid rgba(255,255,255,.07);margin-top:8px">
        <button
          :style="C.confirmBtn(activeSlots.length === PICKS_RICHIESTI)"
          @click="activeSlots.length === PICKS_RICHIESTI ? handleP1Confirm() : undefined"
        >
          {{ activeSlots.length === PICKS_RICHIESTI
            ? '⚔ CONFERMA TEAM'
            : `SCEGLI ANCORA ${PICKS_RICHIESTI - activeSlots.length} WAIFU` }}
        </button>
      </div>

    </div>
  </div>
</template>
