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
import type { CSSProperties } from 'vue'

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

/** Squadra di combattimento: minimo 1, massimo 8 (o quante ne ha il pool). */
const MIN_TEAM = 1
const MAX_TEAM = 8

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
  root: (topOffset = 0): CSSProperties => ({
    position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, bottom: 0, zIndex: 60,
    background: 'var(--theme-bg)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }),
  header: {
    flexShrink: 0,
    padding: '14px 16px 10px',
    borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-surface)',
  } as CSSProperties,
  body: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 16px', WebkitOverflowScrolling: 'touch',
  } as CSSProperties,
  section: { marginBottom: '20px' } as CSSProperties,
  label: {
    fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)", fontSize: '11px', letterSpacing: '0.22em',
    color: 'var(--theme-text-2)', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
  } as CSSProperties,
  confirmBtn: (active: boolean): CSSProperties => ({
    width: '100%', padding: '16px 0', marginTop: '10px',
    background: active ? 'linear-gradient(135deg,#00b050,#00e676)' : 'var(--theme-shimmer)',
    border: active ? 'none' : '1px solid var(--theme-border)',
    borderRadius: '999px', cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.45,
    fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)", fontSize: '15px', fontWeight: 700,
    color: active ? '#fff' : 'var(--theme-text-3)', letterSpacing: '0.18em', textTransform: 'uppercase',
  }),
}

const FF = {
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
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
// TEMA
// ─────────────────────────────────────────────────────────────────────────────
const { isDark } = useTheme()

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
// CPU PICK — la CPU pesca fino a MAX_TEAM waifu (per rarità desc); a confronto scala al team del giocatore
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
  return [...forcedWaifu, ...sortedOthers].slice(0, MAX_TEAM).filter(Boolean) as WaifuDoc[]
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
  } else if (p1Slots.value.length < Math.min(MAX_TEAM, props.roster5P.length)) {
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
    return initBattleWaifu(w as Record<string, unknown>, collectionData) as unknown as WaifuBattleStat
  }).filter(Boolean) as WaifuBattleStat[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: conferma del giocatore
// ─────────────────────────────────────────────────────────────────────────────
function handleP1Confirm() {
  if (p1Slots.value.length < MIN_TEAM) return
  const playerTeam = buildTeam(props.roster5P, p1Slots.value)

  if (props.isPvP) {
    // PvP Online: il team avversario arriva via Firestore dal parent
    emit('confirm', { playerPick3: playerTeam, enemyPick3: [] })
  } else {
    // Modalità CPU: team nemico scalato sulla dimensione della squadra del giocatore
    const enemyCount = Math.max(1, Math.min(p1Slots.value.length, cpuPicks.value.length))
    const enemyTeam: WaifuBattleStat[] = cpuPicks.value.slice(0, enemyCount).map(w => {
      const cpuMoves = w._cpuMoves ?? null
      const waifu = initBattleWaifu(w as Record<string, unknown>, { livello: (w.livello as number) ?? 1 }) as unknown as WaifuBattleStat
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
const maxTeam        = computed(() => Math.min(MAX_TEAM, props.roster5P.length))
const teamValido     = computed(() => activeSlots.value.length >= MIN_TEAM && activeSlots.value.length <= maxTeam.value)
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

/** Stile background della card — usa surface in light mode, gradient scuro in dark */
function cardBackground(isSelected: boolean, rs: ReturnType<typeof getRarityStyle>): string {
  if (isSelected) return isDark.value ? 'rgba(0,230,118,.10)' : 'rgba(0,160,80,.07)'
  return isDark.value ? rs.cardBg : 'var(--theme-surface)'
}

/** Stile box-shadow per rarità alte */
function cardBoxShadow(rarita: string, rs: ReturnType<typeof getRarityStyle>): string {
  // Ombra direzionale tipo carta (niente alone diffuso che arrotonda la silhouette)
  return ['epico', 'leggendario', 'immersivo'].includes(rarita.toLowerCase())
    ? `0 6px 16px ${rs.glow}`
    : '0 4px 12px rgba(0,0,0,0.12)'
}

/** Colore del bordo per il tipo elemento */
function getTypeColor(type?: string): string {
  return (TYPE_COLORS[(type ?? 'Arcana')] as { border?: string })?.border ?? '#444'
}

/** Colori del badge tipo elemento */
function getTypeBadgeStyle(type?: string): CSSProperties {
  const c = (TYPE_COLORS[(type ?? 'Arcana')] ?? { border: '#555', bg: '#111' }) as { border: string; bg: string }
  return {
    background: 'var(--theme-surface)', color: c.border,
    border: `1.5px solid ${c.border}`,
    borderRadius: '999px', padding: '3px 12px', fontSize: '12px',
    fontWeight: 800, fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
    letterSpacing: '0.06em', display: 'inline-block', whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
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
  <div v-if="roster5P.length < ROSTER_MIN" :style="C.root(topOffset)">
    <div :style="({ ...C.header, textAlign: 'center' } as CSSProperties)">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:700;color:#ff4d4d;letter-spacing:2px">
        ⚠ WAIFU INSUFFICIENTI
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
      <div>
        <div style="font-size:40px;margin-bottom:16px">😔</div>
        <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:14px;color:var(--theme-text);line-height:1.6">
          Hai bisogno di almeno {{ ROSTER_MIN }} waifu per partecipare alla pick phase.
        </div>
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;color:var(--theme-text-3);margin-top:8px;letter-spacing:1px">
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
    :style="({ ...C.root(topOffset), alignItems: 'center', justifyContent: 'center' } as CSSProperties)"
  >
    <div
      v-if="terrSel"
      style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;color:#f5a623;letter-spacing:2px;margin-bottom:12px"
    >
      ⚔ {{ terrSel.nome }}
    </div>
    <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:16px;font-weight:700;color:var(--theme-text);letter-spacing:3px;margin-bottom:20px;text-align:center">
      RIVELAZIONE!
    </div>

    <div style="display:flex;gap:24px;align-items:flex-end;justify-content:center">
      <!-- Starter del giocatore -->
      <div style="text-align:center">
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:8px;color:#00C8FF;letter-spacing:2px;margin-bottom:6px">TU</div>
        <div style="width:90px;height:135px;border-radius:10px;overflow:hidden;border:2px solid rgba(0,200,255,.4);background:var(--surface)">
          <img
            v-if="p1ActiveStarter?.asset_statica"
            :src="ikUrl(p1ActiveStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="p1ActiveStarter?.nome ?? ''"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;opacity:.2">◈</div>
        </div>
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;color:var(--theme-text);margin-top:6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ p1ActiveStarter?.nome ?? '—' }}
        </div>
        <!-- TypeBadge inline -->
        <span :style="getTypeBadgeStyle((getBattleStats(p1ActiveStarter ?? {}).type as string) ?? 'Arcana')">
          {{ (getBattleStats(p1ActiveStarter ?? {}).type as string) ?? 'Arcana' }}
        </span>
      </div>

      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:22px;font-weight:900;color:#ff2d78;margin-bottom:30px">VS</div>

      <!-- Starter avversario/CPU -->
      <div style="text-align:center">
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:8px;color:#FF3355;letter-spacing:2px;margin-bottom:6px">
          {{ opponentLabel }}
        </div>
        <div style="width:90px;height:135px;border-radius:10px;overflow:hidden;border:2px solid rgba(255,50,80,.4);background:var(--surface)">
          <img
            v-if="cpuActiveStarter?.asset_statica"
            :src="ikUrl(cpuActiveStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="cpuActiveStarter?.nome ?? ''"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;opacity:.2">◈</div>
        </div>
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;color:var(--theme-text);margin-top:6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ cpuActiveStarter?.nome ?? '—' }}
        </div>
        <!-- TypeBadge inline -->
        <span :style="getTypeBadgeStyle((getBattleStats(cpuActiveStarter ?? {}).type as string) ?? 'Arcana')">
          {{ (getBattleStats(cpuActiveStarter ?? {}).type as string) ?? 'Arcana' }}
        </span>
      </div>
    </div>

    <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:11px;color:var(--theme-text-3);margin-top:20px">
      La battaglia sta per cominciare…
    </div>
  </div>

  <!-- ─────────────────────────────────────────────────────────────────
       STEP PRINCIPALE: picking
       Un solo giocatore per dispositivo. Ogni giocatore vede il proprio
       roster (selezionabile) e quello dell'avversario (sola lettura).
       ───────────────────────────────────────────────────────────────── -->
  <div v-else :style="C.root(topOffset)">

    <!-- ── Header fisso ─────────────────────────────────────────────── -->
    <div :style="C.header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:18px;font-weight:900;color:var(--theme-text)">
            Scelta Team
          </div>
          <div
            v-if="terrSel"
            style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:8px;color:var(--theme-text-3);margin-top:2px;letter-spacing:1px"
          >
            {{ terrSel.nome }} · {{ opponentLabel }}
          </div>
        </div>
        <!-- Badge "TU" — giocatore corrente su questo dispositivo -->
        <!--<div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:16px;font-weight:800;color:#0891b2;background:rgba(8,145,178,.12);border:1.5px solid rgba(8,145,178,.4);border-radius:999px;padding:6px 16px;letter-spacing:0.14em;">
          TU
        </div>-->
      </div>
      <!-- Istruzione + contatore selezioni -->
      <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:14px;color:var(--theme-text-2);margin-top:8px;line-height:1.5">
        Scegli la tua <strong style="color:#a78bfa">squadra di combattimento</strong>. Minimo 1, massimo {{ maxTeam }}. La prima entra subito in campo.
        <span :style="{ color: teamValido ? '#16a34a' : 'var(--theme-accent)', fontWeight: 700, marginLeft: '4px' }">{{ activeSlots.length }}/{{ maxTeam }}</span>
      </div>
    </div>

    <!-- ── Body scrollabile ─────────────────────────────────────────── -->
    <div :style="C.body">

      <!-- Sezione: roster del giocatore (selezionabile) -->
      <div :style="C.section">
        <div :style="C.label">IL TUO ROSTER</div>
        <!-- Griglia 2 colonne — più spaziatura verticale + margini -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px 16px;padding:14px 14px 18px;">
          <template v-for="(w, idx) in activeRoster" :key="w.id ?? idx">
            <button
              :style="({
                border: `2px solid ${cardBorderColor(getSlotNumber(idx) !== null, getRarityStyle(getWaifuRarita(w)))}`,
                borderRadius: '12px !important',
                background: cardBackground(getSlotNumber(idx) !== null, getRarityStyle(getWaifuRarita(w))),
                padding: '0 0 10px',
                cursor: 'pointer', position: 'relative', textAlign: 'left',
                width: '100%', overflow: 'visible',
                transition: 'border-color .15s, background .15s',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: cardBoxShadow(getWaifuRarita(w), getRarityStyle(getWaifuRarita(w))),
                display: 'flex', flexDirection: 'column',
              } as CSSProperties)"
              @click="handleTapRoster(idx)"
            >
              <!-- Badge slot in basso a destra (evita sovrapposizione col chip tipo in alto) -->
              <div v-if="getSlotNumber(idx) !== null"
                style="position:absolute;bottom:-12px;right:-12px;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#00b050,#00e676);display:flex;align-items:center;justify-content:center;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:900;color:#fff;border:2px solid var(--theme-surface);z-index:4">
                {{ getSlotNumber(idx) }}
              </div>
              <!-- Chip tipo top-right della card -->
              <div style="position:absolute;top:-10px;right:-10px;z-index:4;"
                :style="getTypeBadgeStyle((getBattleStats(w).type as string) ?? 'Arcana')">
                {{ (getBattleStats(w).type as string) ?? 'Arcana' }}
              </div>

              <!-- Immagine full-width -->
              <div :style="({ width:'100%', height:'160px', borderRadius:'10px 10px 0 0', overflow:'hidden', background:'var(--theme-bg-secondary)', border:`2px solid ${getRarityStyle(getWaifuRarita(w)).badge}`, borderBottom:'none' } as CSSProperties)">
                <template v-if="getWaifuImgUrl(w)">
                  <img :src="getWaifuImgUrl(w) ?? ''" :alt="(w.nome ?? w.name ?? '') as string" loading="eager" decoding="sync"
                    :style="({ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', filter: w._hotBlurred ? 'blur(5px)' : 'none' } as CSSProperties)" />
                  <div v-if="w._hotBlurred" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(3,2,12,0.4)">
                    <span style="font-size:20px">🔥</span>
                    <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:#ff85b6;font-weight:700">HOT</span>
                  </div>
                </template>
                <div v-else :style="{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'32px',color:getRarityStyle(getWaifuRarita(w)).badge,opacity:0.3 }">◈</div>
              </div>

              <!-- Nome + stats sotto l'immagine -->
              <div style="padding:8px 10px 0;display:flex;flex-direction:column;gap:6px;">
                <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:13px;font-weight:900;color:var(--theme-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {{ w.nome ?? w.name ?? '—' }}
                </div>
                <!-- Stats: ⚡ VEL  💚 HP(grande)  💥 CRIT -->
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div style="display:flex;align-items:center;gap:1px;">
                    <span style="font-size:14px;line-height:1">⚡</span>
                    <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:900;color:#0891b2;line-height:1;">
                      {{ Math.round((w.speed ?? w.velocita ?? w.velocita_base ?? computeSpeed(w as Record<string,unknown>)) as number) }}
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:1px;">
                    <span style="font-size:18px;line-height:1">💚</span>
                    <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:16px;font-weight:900;color:#06d6a0;line-height:1;">
                      {{ (getBattleStats(w).maxHp as number) ?? 300 }}
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:1px;">
                    <span style="font-size:14px;line-height:1">💥</span>
                    <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:900;color:var(--theme-accent);line-height:1;">
                      {{ Math.round(((w.critChance ?? w.crit_chance ?? w.crit_chance_base ?? computeCritChance(w as Record<string,unknown>)) as number) * 100) }}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </template>
        </div>
      </div>

      <!-- Sezione: roster avversario (sola lettura, statistiche nascoste) -->
      <div :style="{ ...C.section, marginTop: '40px' }">
        <div :style="C.label">ROSTER AVVERSARIO — {{ opponentLabel }}</div>

        <!-- Avviso waifu hot oscurate -->
        <div
          v-if="opponentRoster.some(w => w._hotBlurred)"
          style="margin-bottom:8px;padding:8px 12px;background:rgba(255,133,182,0.08);border:1px solid rgba(255,133,182,0.25);border-radius:10px;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:11px;color:rgba(255,133,182,0.85);line-height:1.5"
        >
          🔥 Alcune waifu di <strong>{{ opponentLabel }}</strong> sono Hot e non puoi vederle.
          Acquista il Pass Hard per scoprirle e vederle senza censura.
        </div>

        <!-- Griglia 2 colonne avversario — più spaziatura verticale + margini -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px 16px;padding:14px 14px 18px;">
          <template v-for="(w, idx) in opponentRoster" :key="w.id ?? idx">
            <div
              :style="({
                border: `2px solid ${getRarityStyle(getWaifuRarita(w)).badge}88`,
                borderRadius: '12px',
                background: cardBackground(false, getRarityStyle(getWaifuRarita(w))),
                padding: '0 0 10px',
                cursor: 'default', position: 'relative', textAlign: 'left',
                width: '100%', overflow: 'visible',
                display: 'flex', flexDirection: 'column',
                boxShadow: cardBoxShadow(getWaifuRarita(w), getRarityStyle(getWaifuRarita(w))),
              } as CSSProperties)"
            >
              <div style="position:absolute;top:-10px;right:-10px;z-index:4;"
                :style="getTypeBadgeStyle((getBattleStats(w).type as string) ?? 'Arcana')">
                {{ (getBattleStats(w).type as string) ?? 'Arcana' }}
              </div>
              <div :style="({ width:'100%', height:'160px', borderRadius:'10px 10px 0 0', overflow:'hidden', background:'var(--theme-bg-secondary)', border:`2px solid ${getRarityStyle(getWaifuRarita(w)).badge}`, borderBottom:'none' } as CSSProperties)">
                <template v-if="getWaifuImgUrl(w)">
                  <img :src="getWaifuImgUrl(w) ?? ''" :alt="(w.nome ?? w.name ?? '') as string" loading="eager" decoding="sync"
                    :style="({ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', filter: w._hotBlurred ? 'blur(5px)' : 'none' } as CSSProperties)" />
                  <div v-if="w._hotBlurred" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:rgba(3,2,12,0.4)">
                    <span style="font-size:20px">🔥</span>
                    <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:#ff85b6;font-weight:700">HOT</span>
                  </div>
                </template>
                <div v-else :style="{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'32px',color:getRarityStyle(getWaifuRarita(w)).badge,opacity:0.3 }">◈</div>
              </div>
              <div style="padding:8px 10px 0;">
                <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:13px;font-weight:900;color:var(--theme-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {{ w.nome ?? w.name ?? '—' }}
                </div>
                <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:11px;color:var(--theme-text-3);margin-top:4px;">
                  ? ? ?
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Nota CPU -->
        <div
          v-if="isCpu"
          style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:10px;color:rgba(238,232,220,.35);margin-top:6px;text-align:center"
        >
          La CPU ha già scelto il suo team — vedrai quale solo all'inizio della battaglia.
        </div>
      </div>

    </div>

    <!-- ── Bottone CONFERMA fisso fuori dal body scrollabile ── -->
    <div style="flex-shrink:0;padding:12px 16px 28px;background:var(--theme-surface);border-top:1px solid var(--theme-border);z-index:100;box-shadow:0 -4px 20px var(--theme-shadow);">
      <button
        :style="C.confirmBtn(teamValido)"
        @click="teamValido ? handleP1Confirm() : undefined"
      >
        {{ teamValido
          ? '⚔ Inizia battaglia →'
          : 'Scegli almeno 1 waifu' }}
      </button>
    </div>
  </div>
</template>
