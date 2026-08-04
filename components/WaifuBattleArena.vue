<script setup lang="ts">
/**
 * WaifuBattleArena — Arena di battaglia turno per turno (PvCPU e PvP online).
 *
 * Gestisce il ciclo completo di combattimento: scelta mossa del giocatore,
 * decisione AI della CPU, animazioni sprite, calcolo danno, KO, swap, e
 * popup di risultato finale con MVP, statistiche e Bo3.
 *
 * Layout fisso (position:fixed, top→bottom):
 *   Header  → turno, score KO, timer
 *   Enemy Zone  → sprite nemico + HUD
 *   Message Bar → log testuale
 *   Player Zone → sprite giocatore + HUD
 *   Action Panel → griglia mosse 2×2 + bottone cambio
 */

// Icone Lucide — sostituiscono emoji negli stati battaglia, badge HOT e lock mosse
// Nota: HeartCrack → sconfitta, Handshake → pareggio, Crown → vittoria
import { Swords, Zap, Handshake, Crown, HeartCrack, Flame, Lock } from 'lucide-vue-next'

import {
  TYPE_COLORS,
  getEffectiveness,
  calculateDamage,
  isMoveBlocked,
  cpuChooseMove,
  cpuDecideSwap,
  initBattleTeam,
  generateCPUTeam,
  type WaifuBattleStat,
  type MoveInstance,
} from '~/utils/battleEngine'
import { ikUrl } from '~/utils/imagekitUrl'
import backCardImg from '~/assets/images/back_card.png'
import { moves as MOVES_DATA } from '~/assets/moves/moves-data'

// ─── PROPS ────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Team del giocatore: array di WaifuBattleStat già inizializzati con mosse/hp */
  playerTeam:               WaifuBattleStat[]
  /** Team nemico: se omesso, viene generato dalla CPU */
  enemyTeam?:               WaifuBattleStat[]
  /** Catalogo waifu usato per generare il team CPU se enemyTeam è assente */
  waifuCat?:                Record<string, unknown>[]
  /** Contesto battaglia: nomi, flag, stato Bo3 */
  battleCtx?:               Record<string, unknown> | null
  /** Modalità PvP online */
  isPvP?:                   boolean
  /** Indice mossa avversario da Firestore (PvP) */
  pvpOpponentMove?:         number | null
  /** True se in attesa della mossa avversaria (PvP) */
  pvpWaiting?:              boolean
  /** Seed RNG condiviso per calcolo deterministico (PvP) */
  pvpBattleSeed?:           number | null
  /** Indice waifu sostituta dell'avversario dopo un KO (PvP, da Firestore) */
  pvpOpponentKoReplacement?: number | null
}>(), {
  enemyTeam:               undefined,
  waifuCat:                () => [],
  battleCtx:               null,
  isPvP:                   false,
  pvpOpponentMove:         null,
  pvpWaiting:              false,
  pvpBattleSeed:           null,
  pvpOpponentKoReplacement: null,
})

// ─── EMITS ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  /** Emesso al termine della battaglia con il risultato (isVictory e dati) */
  battleResult: [result: unknown]
  /** Emesso alla chiusura del popup risultato */
  exit:         [choice?: string | null]
  /** PvP: invia la mossa scelta a Firestore */
  pvpMoveSubmit: [moveIdx: number]
  /** PvP: avanza il turno dopo la risoluzione locale */
  pvpTurnAdvance: []
  /** PvP: comunica la scelta sostituta dopo un KO */
  pvpKoReplacement: [idx: number]
}>()

// ─── COSTANTI TIMING ANIMAZIONI ───────────────────────────────────────────────

/** Durata dell'animazione di attacco (swing) in ms */
const ANIM_ATTACK_MS           = 320
/** Durata dello shake quando si riceve danno in ms */
const ANIM_SHAKE_MS            = 120
/** Pausa tra il primo e il secondo attacco nello stesso turno */
const ANIM_BETWEEN_ATTACKS_MS  = 520
// #26: durata di visualizzazione di ogni riga di log (effetti/efficacia/abilità)
const LOG_MS                   = 650
/** Durata dell'animazione KO (caduta waifu) in ms */
const ANIM_KO_MS               = 600
/** Durata della transizione di ingresso nuova waifu in ms */
const ANIM_ENTER_MS            = 500
/** Pausa prima di tornare allo stato di scelta mossa dopo uno swap volontario */
const ANIM_VOLUNTARY_SWAP_MS   = 900
/** Ritardo in ms prima di mostrare l'animazione di risultato alla fine */
const ANIM_RESULT_DELAY_MS     = 400

// ─── COSTANTI UI TIPO ─────────────────────────────────────────────────────────

/** Override colore Ferro in UI (grigio chiaro per distinguerlo dalle mosse disabilitate) */
const _TYPE_COLORS_UI: Record<string, { bg: string; text: string; border: string }> = {
  ...TYPE_COLORS,
  Ferro: { bg: 'rgba(71,85,105,0.82)', text: '#f1f5f9', border: '#94a3b8' },
}

/** Stile mosse disabilitate (PP esauriti / cooldown): grigio scuro opaco */
const _DISABLED_MOVE_STYLE = {
  bg:     'rgba(40,40,40,0.5)',
  border: '0.8px solid #383838',
  color:  '#525252',
}

/** Encode/decode swap: moveIndex < 0 = "swap alla waifu (-moveIndex - 1)" */
const encodeSwap = (waifuIdx: number) => -(waifuIdx + 1)
const decodeSwap = (moveIdx: number) => (typeof moveIdx === 'number' && moveIdx < 0) ? (-moveIdx - 1) : -1

/** Sentinel CPU skip: la CPU ha già swappato volontariamente questo turno */
const _CPU_SKIP = -1000

// ─── CSS ANIMAZIONI (iniettato una sola volta) ────────────────────────────────

const BATTLE_CSS = `
  @keyframes slideInLeft  {from{transform:translateX(-115%) scaleX(.92);opacity:0}to{transform:translateX(0) scaleX(1);opacity:1}}
  @keyframes slideInRight {from{transform:translateX(115%) scaleX(.92);opacity:0}to{transform:translateX(0) scaleX(1);opacity:1}}
  /* Attacco = zoom smooth della carta (con leggero affondo in avanti) */
  @keyframes atkRight {0%{transform:translateX(0) scale(1)}50%{transform:translateX(26px) scale(1.26)}100%{transform:translateX(0) scale(1)}}
  @keyframes atkLeft  {0%{transform:translateX(0) scale(1)}50%{transform:translateX(-26px) scale(1.26)}100%{transform:translateX(0) scale(1)}}
  @keyframes shake {0%,100%{transform:translateX(0)}18%{transform:translateX(-11px)}36%{transform:translateX(11px)}54%{transform:translateX(-8px)}72%{transform:translateX(8px)}88%{transform:translateX(-4px)}}
  @keyframes flash {0%{opacity:0}25%{opacity:.82}100%{opacity:0}}
  @keyframes koFx  {0%{transform:scale(1);opacity:1}60%{transform:scale(.82) translateY(10px);opacity:.4}100%{transform:scale(.38) translateY(32px);opacity:0}}
  @keyframes fadeMsg  {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  .wba-screenshake { animation: wbaShake 0.42s cubic-bezier(.36,.07,.19,.97); }
  @keyframes wbaShake {
    10%, 90% { transform: translate3d(-2px, 0, 0); }
    20%, 80% { transform: translate3d(3px, 1px, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, -1px, 0); }
    40%, 60% { transform: translate3d(4px, 1px, 0); }
  }
  @keyframes floatDmg {0%{opacity:1;transform:translateY(0) scale(.9)}18%{transform:translateY(-22px) scale(1.35)}62%{opacity:1;transform:translateY(-52px) scale(1.12)}100%{opacity:0;transform:translateY(-84px) scale(1)}}
  @keyframes hpCrit   {0%,100%{filter:brightness(1)}50%{filter:brightness(1.8) saturate(1.5)}}
  .wba-hp-crit { animation: hpCrit 0.8s ease-in-out infinite; }
  /* ── Moneta (effetti bloccanti): testa = retro carta · croce = grigio ── */
  .wba-coin-scene { width: 150px; height: 150px; perspective: 700px; }
  .wba-coin {
    position: relative; width: 100%; height: 100%;
    transform-style: preserve-3d;
  }
  .wba-coin--spin  { animation: coinSpin 0.55s linear infinite; }
  .wba-coin--heads { animation: coinLandHeads 0.5s ease-out forwards; }
  .wba-coin--tails { animation: coinLandTails 0.5s ease-out forwards; }
  .wba-coin__face {
    position: absolute; inset: 0; border-radius: 50%;
    overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden;
    border: 3px solid #f5c560; box-shadow: 0 0 26px rgba(245,197,96,0.5);
    background: #0a0618;
  }
  .wba-coin__face img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .wba-coin__face--back { transform: rotateY(180deg); }
  @keyframes coinSpin { from { transform: rotateY(0) } to { transform: rotateY(360deg) } }
  @keyframes coinLandHeads { from { transform: rotateY(0) }   to { transform: rotateY(720deg) } }
  @keyframes coinLandTails { from { transform: rotateY(0) }   to { transform: rotateY(900deg) } }
  @keyframes timerUrg {0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}
  @keyframes benchPop {from{transform:scale(.88);opacity:.65}to{transform:scale(1);opacity:1}}
  @keyframes victPop  {0%{transform:scale(.5);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
  @keyframes dotPulse {0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.35);opacity:1}}
  @keyframes stripIn  {from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scorePop {0%{transform:scale(1)}30%{transform:scale(1.55)}65%{transform:scale(.92)}100%{transform:scale(1)}}
  .wba-score-pop { animation: scorePop .48s cubic-bezier(.36,.07,.19,.97) both; }
  .wba-sL{animation:slideInLeft  .38s ease-out}
  .wba-sR{animation:slideInRight .38s ease-out}
  .wba-aR{animation:atkRight .58s ease-in-out}
  .wba-aL{animation:atkLeft  .58s ease-in-out}
  .wba-sh{animation:shake .36s ease-in-out}
  .wba-ko{animation:koFx .55s ease-in forwards}
  .wba-fm{animation:fadeMsg .2s ease-out}
  .wba-move-btn{transition:transform .08s ease,filter .08s ease,opacity .18s ease;-webkit-tap-highlight-color:transparent;cursor:pointer}
  .wba-move-btn:active:not(:disabled){transform:scale(.94);filter:brightness(1.28)}
  .wba-move-btn:disabled{cursor:not-allowed}
  .wba-bench-slot{transition:transform .1s ease;-webkit-tap-highlight-color:transparent;border-radius:10px!important}
  .wba-bench-slot:active:not(:disabled){transform:scale(.9)}

  /* ── Barra HP BOSS (raid) ── */
  .wba-boss-bar{width:100%;padding:10px 16px 12px;background:var(--theme-surface);border-bottom:1px solid var(--border-subtle);box-shadow:var(--shadow-float);position:relative;z-index:6}
  .wba-boss-bar__label{display:flex;align-items:center;gap:8px;margin-bottom:7px}
  .wba-boss-bar__badge{background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;font-family:var(--ff-label,'Nunito',sans-serif);font-size:10px;font-weight:900;letter-spacing:2px;padding:2px 9px;border-radius:9999px;box-shadow:0 0 10px rgba(231,76,60,.5)}
  .wba-boss-bar__name{font-family:var(--ff-display,'Fredoka',sans-serif);font-size:15px;font-weight:900;color:var(--theme-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
  .wba-boss-bar__pct{font-family:var(--ff-label,'Nunito',sans-serif);font-size:15px;font-weight:900;color:#f39c12}
  .wba-boss-bar__track{width:100%;height:14px;background:var(--surface-sunken);border-radius:9999px;overflow:hidden;border:1px solid var(--border-subtle)}
  .wba-boss-bar__fill{height:100%;background:linear-gradient(90deg,#e74c3c,#f39c12);border-radius:9999px;transition:width .5s cubic-bezier(.25,.8,.25,1);box-shadow:0 0 12px rgba(243,156,18,.5)}
  .wba-boss-bar__value{font-family:var(--ff-label,'Nunito',sans-serif);font-size:11px;font-weight:800;color:var(--theme-text-2);margin-top:4px;text-align:right}
`

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Promise che si risolve dopo `ms` millisecondi */
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Converte hex 6 cifre in "R,G,B" per rgba() CSS inline */
function hexToRgb(hex = '#555'): string {
  const h = (hex || '#555').replace('#', '')
  if (h.length < 6) return '85,85,85'
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

/** Sfondo carta per rarità */
function getRarityCardBg(rarità?: string): string {
  switch (rarità?.toLowerCase()) {
    case 'leggendario': return 'linear-gradient(160deg, rgb(74,49,5) 0%, rgb(29,17,2) 100%)'
    case 'epico':       return 'linear-gradient(160deg, rgb(42,18,85) 0%, rgb(16,5,42) 100%)'
    case 'immersivo':   return 'linear-gradient(160deg, rgb(79,18,69) 0%, rgb(30,4,32) 100%)'
    case 'raro':        return 'linear-gradient(160deg, rgb(20,42,85) 0%, rgb(6,17,44) 100%)'
    default:            return 'linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)'
  }
}
const FOIL_RARITIES = ['epico', 'leggendario', 'immersivo']

// ─── STATO PRINCIPALE ─────────────────────────────────────────────────────────

/** Costruisce team giocatore dalla prop o genera dal catalogo */
function buildPlayer(): WaifuBattleStat[] {
  return props.playerTeam?.length
    ? props.playerTeam.map(w => ({ ...w }))
    : initBattleTeam((props.waifuCat ?? []).slice(0, 4))
}

/** Costruisce team nemico dalla prop o genera CPU casuale */
function buildEnemy(): WaifuBattleStat[] {
  if (props.enemyTeam?.length) return props.enemyTeam.map(w => ({ ...w }))
  const pids = new Set((props.playerTeam ?? []).map(w => w.id))
  return generateCPUTeam(props.waifuCat ?? [], pids, 3)
}

// Team attivi e indici waifu sul campo
const pTeam   = ref<WaifuBattleStat[]>(buildPlayer())
const eTeam   = ref<WaifuBattleStat[]>(buildEnemy())
const pActive = ref(0)
const eActive = ref(0)

// Shortcut waifu attivi
const player = computed(() => pTeam.value[pActive.value])
const enemy  = computed(() => eTeam.value[eActive.value])

// ── EFFETTI DELLE MOSSE (dot/shield/control/buff/debuff) ─────────────────────
// Ogni effetto è legato alla waifu ATTIVA del lato colpito: se quella waifu
// viene sostituita (cambio volontario, KO, swap CPU) l'effetto termina subito.
interface ActiveEffect {
  status: string
  label: string
  kind: 'dot' | 'shield' | 'control' | 'buff' | 'debuff'
  turni: number             // turni rimanenti
  dannoPerTurno?: number    // dot: HP persi a turno · buff: HP curati a turno
}
const fieldEffects = ref<{ player: ActiveEffect[]; enemy: ActiveEffect[] }>({ player: [], enemy: [] })

/** Applica l'effetto della mossa: buff/shield sull'attaccante, il resto sul difensore. */
function applyMoveEffect(attSide: 'player' | 'enemy', move: any) {
  const eff = move?.effect
  if (!eff?.kind || !(eff.durataTurni > 0)) return
  const targetSide: 'player' | 'enemy' =
    (eff.kind === 'buff' || eff.kind === 'shield') ? attSide : (attSide === 'player' ? 'enemy' : 'player')
  // Nessuno stacking: la riapplicazione rinnova la durata
  const list = fieldEffects.value[targetSide].filter(e => e.status !== eff.status)
  list.push({ status: eff.status, label: eff.label, kind: eff.kind, turni: eff.durataTurni, dannoPerTurno: eff.dannoPerTurno })
  fieldEffects.value = { ...fieldEffects.value, [targetSide]: list }
}

/** Moltiplicatore danno in uscita: buff proprio +40%, debuff proprio -30%, scudo del difensore -50%. */
function effectDamageMult(attSide: 'player' | 'enemy'): number {
  let mult = 1
  const own = fieldEffects.value[attSide]
  if (own.some(e => e.kind === 'buff' && !(e.dannoPerTurno! > 0))) mult *= 1.4
  if (own.some(e => e.kind === 'debuff')) mult *= 0.7
  const defSide = attSide === 'player' ? 'enemy' : 'player'
  if (fieldEffects.value[defSide].some(e => e.kind === 'shield')) mult *= 0.5
  return mult
}

/** Effetto control attivo (immobilizzo/stordimento): la waifu salta l'attacco. */
function controlEffect(side: 'player' | 'enemy'): ActiveEffect | undefined {
  return fieldEffects.value[side].find(e => e.kind === 'control')
}

// REGOLA (game design): l'effetto è legato alla waifu che lo SUBISCE, non a chi
// l'ha lanciato. Termina SOLO se viene sostituita/KO la waifu colpita; se invece
// muore o viene cambiata la waifu dell'ATTACCANTE, l'effetto sul bersaglio
// continua normalmente. Per questo ogni watch svuota SOLO il proprio lato:
// pActive → effetti subiti dalla waifu del giocatore; eActive → da quella nemica.
watch(pActive, () => { fieldEffects.value = { ...fieldEffects.value, player: [] } })
watch(eActive, () => { fieldEffects.value = { ...fieldEffects.value, enemy: [] } })

// ── Long-press su una mossa: popup con la CARTA della mossa e la spiegazione ──
// (gli effetti non sono mostrati sul bottone: si vedono qui)
const moveDetail = ref<Record<string, unknown> | null>(null)
let lpTimer: ReturnType<typeof setTimeout> | null = null
let lpFired = false
function moveLongPressStart(move: MoveInstance | null) {
  if (!move) return
  lpFired = false
  if (lpTimer) clearTimeout(lpTimer)
  lpTimer = setTimeout(() => {
    lpFired = true
    // I nomi delle mosse in battaglia arrivano da Firestore (non dal catalogo
    // statico moves-data), quindi il match per nome fallisce sempre: costruiamo
    // il dettaglio DIRETTAMENTE dalla MoveInstance reale così si vede la mossa vera.
    const full = MOVES_DATA.find(m => m.name === move.name)
    const eff = (move as unknown as { effect?: { label?: string } | null }).effect ?? null
    moveDetail.value = (full as unknown as Record<string, unknown>) ?? {
      id: '', name: move.name, type: String(move.type ?? 'arcana').toLowerCase(),
      damage: move.power,
      additionalEffectLabel: eff?.label ?? '',
      effectDescription: eff?.label ?? (move.ability ?? '') ,
      flavorText: '', isUltimate: (move.rarity === 'leggendario' || move.rarity === 'immersivo'),
      imageFileName: '', imageUrl: '',
    }
  }, 420)
}
function moveLongPressEnd() {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null }
}

// #27: dettaglio della waifu attiva (propria o avversaria) al tap in battaglia.
const waifuDetail = ref<{ w: WaifuBattleStat; side: 'player' | 'enemy' } | null>(null)
function openWaifuDetail(w: WaifuBattleStat | undefined, side: 'player' | 'enemy') {
  if (w) waifuDetail.value = { w, side }
}
/** true (una volta) se il long-press è appena scattato: annulla il click. */
function consumeLongPress(): boolean {
  const fired = lpFired
  lpFired = false
  return fired
}

// ── LANCIO MONETA (effetti bloccanti) ────────────────────────────────────────
// Se la waifu è vittima di un effetto CONTROL (immobilizzo/stordimento), a
// inizio turno lancia una moneta: TESTA → l'effetto svanisce e attacca
// normalmente; CROCE → l'effetto permane e salta il turno.
// #12: `effect` = quale effetto di stato causa il lancio (es. Stordimento, Sonno,
// Bruciatura) così è chiaro perché si lancia la moneta.
const coinFlip = ref<{ who: string; effect: string; result: 'testa' | 'croce'; done: boolean } | null>(null)
function flipCoinFor(who: string, effect = ''): Promise<boolean> {
  return new Promise(resolve => {
    const heads = Math.random() < 0.5
    coinFlip.value = { who, effect, result: heads ? 'testa' : 'croce', done: false }
    // 1.7s di rotazione + 0.9s per leggere il risultato
    setTimeout(() => { if (coinFlip.value) coinFlip.value.done = true }, 1700)
    setTimeout(() => { coinFlip.value = null; resolve(heads) }, 2600)
  })
}
/** Rimuove gli effetti control dal lato indicato (moneta: testa). */
function clearControl(side: 'player' | 'enemy') {
  fieldEffects.value = {
    ...fieldEffects.value,
    [side]: fieldEffects.value[side].filter(e => e.kind !== 'control'),
  }
}

/** Stile chip effetto per gli HUD: colore per tipo di effetto. */
const EFFECT_CHIP_COLORS: Record<ActiveEffect['kind'], string> = {
  dot: '#ff6b4a', control: '#b46bff', debuff: '#9aa4b5', buff: '#58e0a3', shield: '#4ac3ff',
}
function effectChipStyle(e: ActiveEffect) {
  const col = EFFECT_CHIP_COLORS[e.kind] ?? '#9aa4b5'
  return {
    display: 'inline-flex' as const, alignItems: 'center', gap: '4px',
    fontFamily: 'var(--ff-label)', fontSize: '11px', fontWeight: 800, lineHeight: 1.15,
    letterSpacing: '0.03em', textTransform: 'uppercase' as const,
    color: col, background: `${col}26`, border: `1px solid ${col}80`,
    borderRadius: '999px', padding: '4px 9px',
    // Wrap consentito: gli effetti spiegano cosa subisce la waifu senza troncare.
    whiteSpace: 'normal' as const, maxWidth: '150px',
    boxShadow: `0 0 10px ${col}40`,
  }
}
// Icona esplicita per tipo di effetto: chiarisce a colpo d'occhio cosa sta subendo
// la waifu (🔥 brucia/danno nel tempo, 🛡️ scudo, 💫 stordita, 🔺 potenziata, 🔻 indebolita).
const EFFECT_ICONS: Record<ActiveEffect['kind'], string> = {
  dot: '🔥', control: '💫', debuff: '🔻', buff: '🔺', shield: '🛡️',
}
function effectIcon(e: ActiveEffect) {
  // Danno-nel-tempo positivo (rigenerazione) usa 💚 invece di 🔥
  if (e.kind === 'buff' && (e.dannoPerTurno ?? 0) > 0) return '💚'
  return EFFECT_ICONS[e.kind] ?? '✨'
}

// Raid boss: nemico unico con HP potenziati (flag impostato da RoundViewer)
const isBoss     = computed(() => !!(enemy.value as any)?.isRaidBoss)
const bossHpPct  = computed(() => {
  const e = enemy.value
  return e && e.maxHp > 0 ? Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100)) : 0
})

// Animazioni sprite
const pAnim     = ref('wba-sL')
const eAnim     = ref('wba-sR')
const showFlash = ref(false)
const showBench = ref(false)

// Floating damage numbers
interface DmgFloat { id: number; dmg: number; side: 'player' | 'enemy'; isCrit: boolean }
const dmgFloats = ref<DmgFloat[]>([])
const screenShake = ref(false)   // shake dell'arena sul colpo critico

// Fasi di battaglia e turno
type Phase = 'entering' | 'playerChoose' | 'resolving' | 'playerSwap' | 'voluntarySwap' | 'victory' | 'defeat' | 'result' | 'pvpWaitingKoReplacement'
const phase   = ref<Phase>('entering')
const message = ref('Che la battaglia abbia inizio!')
const turn    = ref(1)
const totalDmg = ref(0)
const isAnim  = ref(false)
const timer   = ref(30)
const lastPMove = ref<number | null>(null)
const lastEMove = ref<number | null>(null)

// Responsive
const isMobile = ref(true)

// Offset header / bottom nav
const topOffset    = ref(0)
const bottomOffset = ref(0)

// Statistiche per il popup risultato
const statsP = ref({ ko: 0, dmg: 0 })
const statsE = ref({ ko: 0, dmg: 0 })

// Ref speculari aggiornati in sync con i setter (evitano race condition nel popup)
let statsPRef = { ko: 0, dmg: 0 }
let statsERef = { ko: 0, dmg: 0 }
let biggestHitRef = { dmg: 0, waifuName: '', moveName: '', wasCrit: false, side: '' }

// Statistiche per waifu (calcolo MVP)
const waifuStats = ref<Record<string, { name: string; imgUrl: string | null; kos: number; dmg: number; side: string }>>({})
let waifuStatsRef: typeof waifuStats.value = {}

// Animazione score KO
const koAnimP = ref(false)
const koAnimE = ref(false)
let koAnimPTimer: ReturnType<typeof setTimeout> | null = null
let koAnimETimer: ReturnType<typeof setTimeout> | null = null

// Biggest hit
interface BiggestHit { dmg: number; waifuName: string; moveName: string; wasCrit: boolean; side?: string }
const biggestHitState = ref<BiggestHit>({ dmg: 0, waifuName: '', moveName: '', wasCrit: false })

// Risultato finale congelato al momento della vittoria/sconfitta
interface RisultatoFinale {
  isVictory: boolean
  statsP:    { ko: number; dmg: number }
  statsE:    { ko: number; dmg: number }
  biggestHit: BiggestHit
  isDraw:    boolean
  waifuStats?: typeof waifuStats.value
}
const risultatoFinale = ref<RisultatoFinale | null>(null)

// HP precedenti per floating damage numbers
// Inizializzati agli HP di partenza: senza questo il PRIMO colpo (prev=null)
// non veniva mai mostrato → "al primo turno non vedo il danno".
let prevPHp: number | null = player.value?.hp ?? null
let prevEHp: number | null = enemy.value?.hp ?? null
let lastFloatPActive = pActive.value
let lastFloatEActive = eActive.value
let dmgIdCounter = 0
let lastCritFlag  = false

// Flag anti-rientro per resolveTurn
let resolveActive = false

// Countdown timer interval
let timerInterval: ReturnType<typeof setInterval> | null = null

// Ultimo turno in cui la CPU ha fatto uno swap volontario
let cpuLastVolSwapTurn = -1

// PvP: mossa player in attesa + ref mossa avversaria
let pendingPMove: number | null = null
let pvpOpMoveLocal: number | null = null

// ─── SCROLL LOCK ──────────────────────────────────────────────────────────────

/** Blocca lo scroll del body durante la battaglia */
useScrollLock(true)

// Pre-render: scalda subito le immagini di ENTRAMBI i team (sprite 'normal' +
// bench 'thumbnail') così in combattimento non si vede mai un caricamento.
onMounted(() => {
  try {
    for (const w of [...pTeam.value, ...eTeam.value]) {
      for (const preset of ['normal', 'thumbnail', 'card'] as const) {
        const u = ikUrl(w.image ?? null, preset)
        if (u) { const img = new Image(); img.decoding = 'async'; img.src = u }
      }
    }
  } catch { /* best effort */ }
})

// Tema — colori adattivi per light/dark mode
const { isDark } = useTheme()

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

onMounted(() => {
  // Inietta CSS animazioni una volta sola
  if (!document.getElementById('wba-css')) {
    const s = document.createElement('style')
    s.id = 'wba-css'
    s.textContent = BATTLE_CSS
    document.head.appendChild(s)
  }

  // Responsive breakpoint
  const checkMobile = () => { isMobile.value = window.innerWidth < 768 }
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // Calcolo offset header/bottom nav
  const calcOffset = () => {
    const hdr   = document.querySelector('.hdr-root')
    const ntabs = document.querySelector('.ntabs-root')
    const bnav  = document.querySelector('.bottom-nav-mobile')
    topOffset.value    = (hdr?.getBoundingClientRect().height ?? 0) + (ntabs?.getBoundingClientRect().height ?? 0)
    bottomOffset.value = bnav?.getBoundingClientRect().height ?? 0
  }
  calcOffset()
  window.addEventListener('resize', calcOffset)

  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
    window.removeEventListener('resize', calcOffset)
    if (timerInterval) clearInterval(timerInterval)
    if (koAnimPTimer)  clearTimeout(koAnimPTimer)
    if (koAnimETimer)  clearTimeout(koAnimETimer)
  })
})

// ─── FLOATING DAMAGE NUMBERS ─────────────────────────────────────────────────

/** Traccia delta HP giocatore e mostra floating number */
watch(() => player.value?.hp, (curr) => {
  if (curr === undefined) return
  // Cambio waifu: sincronizza il riferimento senza mostrare un danno spurio
  if (pActive.value !== lastFloatPActive) { lastFloatPActive = pActive.value; prevPHp = curr ?? null; return }
  if (prevPHp !== null && curr < prevPHp && prevPHp > 0) {
    const dmg    = prevPHp - curr
    const id     = ++dmgIdCounter
    const isCrit = lastCritFlag
    lastCritFlag = false
    dmgFloats.value.push({ id, dmg, side: 'player', isCrit })
    setTimeout(() => { dmgFloats.value = dmgFloats.value.filter(f => f.id !== id) }, 1400)
  }
  prevPHp = curr ?? null
})

/** Traccia delta HP nemico e mostra floating number */
watch(() => enemy.value?.hp, (curr) => {
  if (curr === undefined) return
  if (eActive.value !== lastFloatEActive) { lastFloatEActive = eActive.value; prevEHp = curr ?? null; return }
  if (prevEHp !== null && curr < prevEHp && prevEHp > 0) {
    const dmg    = prevEHp - curr
    const id     = ++dmgIdCounter
    const isCrit = lastCritFlag
    lastCritFlag = false
    dmgFloats.value.push({ id, dmg, side: 'enemy', isCrit })
    setTimeout(() => { dmgFloats.value = dmgFloats.value.filter(f => f.id !== id) }, 1400)
  }
  prevEHp = curr ?? null
})

// ─── FASE ENTERING ────────────────────────────────────────────────────────────

/** Animazione di entrata: dopo 800ms passa alla scelta mossa */
watch(phase, (p) => {
  if (p !== 'entering') return
  setTimeout(() => {
    pAnim.value = ''
    eAnim.value = ''
    phase.value   = 'playerChoose'
    message.value = 'Scegli la tua mossa!'
    timer.value   = 30
  }, 800)
}, { immediate: true })

// ─── SWAP VOLONTARIO CPU ──────────────────────────────────────────────────────

/**
 * All'inizio di ogni turno (fase playerChoose), se non è PvP e non è il turno 1,
 * la CPU valuta se cambiare waifu strategicamente prima che il giocatore attacchi.
 * Se decide di cambiare, esegue il cambio e il turno avanza senza che la CPU attacchi.
 */
watch([phase, isAnim], async ([p, anim]) => {
  if (p !== 'playerChoose') return
  if (props.isPvP) return
  if (anim) return
  if (turn.value <= 1) return
  if (cpuLastVolSwapTurn >= turn.value) return

  const curEnemy  = eTeam.value[eActive.value]
  const curPlayer = pTeam.value[pActive.value]
  if (!curEnemy || !curPlayer) return

  const { shouldSwap, swapToIdx } = cpuDecideSwap([...eTeam.value], eActive.value, curPlayer)
  if (!shouldSwap) return

  isAnim.value = true
  phase.value  = 'resolving'

  await wait(ANIM_RESULT_DELAY_MS)
  cpuLastVolSwapTurn = turn.value
  eActive.value = swapToIdx
  eAnim.value   = 'wba-sR'
  message.value = `La CPU manda in campo ${eTeam.value[swapToIdx]?.name}!`
  await wait(ANIM_ENTER_MS)
  eAnim.value   = ''
  await wait(200)
  message.value = 'La CPU ha cambiato waifu — scegli la tua mossa!'
  turn.value++
  isAnim.value  = false
  phase.value   = 'playerChoose'
  timer.value   = 30
})

// ─── COUNTDOWN TIMER ─────────────────────────────────────────────────────────

/** Countdown timer: se scade seleziona automaticamente una mossa disponibile */
watch([phase, pActive], ([p]) => {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  if (p !== 'playerChoose') return

  timerInterval = setInterval(() => {
    if (timer.value <= 1) {
      clearInterval(timerInterval!)
      timerInterval = null
      const pl = player.value
      const avail = (pl?.moves ?? [])
        .map((_, i) => i)
        .filter(i => {
          const m = pl!.moves[i]
          return (m.pp ?? 0) > 0 && !isMoveBlocked(lastPMove.value, i, m)
        })
      if (avail.length) handleMove(avail[Math.floor(Math.random() * avail.length)])
      else startVoluntarySwap()
      timer.value = 0
      return
    }
    timer.value--
  }, 1000)
})

// ─── PVP: SYNC MOSSA AVVERSARIA ───────────────────────────────────────────────

/** Aggiorna la ref locale della mossa avversaria PvP */
watch(() => props.pvpOpponentMove, (v) => { pvpOpMoveLocal = v ?? null })

/** PvP: quando arriva la mossa dell'avversario da Firestore, risolve il turno */
watch(() => props.pvpOpponentMove, (opMove) => {
  if (!props.isPvP || opMove == null || pendingPMove == null) return
  if (resolveActive) return
  resolveTurn(pendingPMove, opMove, null)
  pendingPMove = null
})

/** PvP: quando l'avversario comunica la waifu sostituta dopo un KO, aggiorna eActive */
watch(() => props.pvpOpponentKoReplacement, async (chosenIdx) => {
  if (!props.isPvP || chosenIdx == null) return
  if (phase.value !== 'pvpWaitingKoReplacement') return
  eActive.value = chosenIdx
  eAnim.value   = 'wba-sR'
  message.value = `${eTeam.value[chosenIdx]?.name} entra in campo!`
  setTimeout(() => { eAnim.value = '' }, 450)
  await wait(ANIM_ENTER_MS)
  phase.value   = 'playerChoose'
  message.value = 'Scegli la tua mossa!'
  timer.value   = 30
})

// ─── FINE BATTAGLIA ───────────────────────────────────────────────────────────

/** Al termine (victory/defeat): congela le stats, notifica il genitore, mostra popup */
watch(phase, (p) => {
  if (p !== 'victory' && p !== 'defeat') return
  const won = p === 'victory'
  risultatoFinale.value = {
    isVictory:  won,
    statsP:     { ...statsPRef },
    statsE:     { ...statsERef },
    biggestHit: { ...biggestHitRef },
    isDraw:     false,
    waifuStats: { ...waifuStatsRef },
  }
  emit('battleResult', { ...risultatoFinale.value, isVictory: won })
  setTimeout(() => { phase.value = 'result' }, ANIM_RESULT_DELAY_MS)
})

// ─── HELPERS BATTAGLIA ────────────────────────────────────────────────────────

/** True se tutti i membri del team sono KO */
const allKO = (t: WaifuBattleStat[]) => t.every(w => w.isKO)

/** Indice della prossima waifu viva nel team (circolare), -1 se nessuna */
function nextAlive(team: WaifuBattleStat[], cur: number): number {
  for (let i = 1; i < team.length; i++) {
    const idx = (cur + i) % team.length
    if (!team[idx].isKO) return idx
  }
  return -1
}

/** Flash schermo bianco breve */
function triggerFlash() {
  showFlash.value = true
  setTimeout(() => { showFlash.value = false }, 180)
}

// ─── SWAP VOLONTARIO GIOCATORE ────────────────────────────────────────────────

/** Avvia la fase di cambio volontario (senza KO) */
function startVoluntarySwap() {
  showBench.value = true
  phase.value     = 'voluntarySwap'
  message.value   = 'Scegli la waifu da mandare in campo!'
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

/**
 * Gestisce lo swap volontario del giocatore.
 * isPPExhausted: true = swap forzato per PP esauriti, la waifu corrente viene marcata KO.
 */
async function handleVoluntarySwap(newIdx: number, { isPPExhausted = false } = {}) {
  if (phase.value !== 'voluntarySwap' && phase.value !== 'playerChoose') return
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  isAnim.value    = true
  showBench.value = false
  phase.value     = 'resolving'

  // PP esauriti: marca la waifu corrente come KO
  if (isPPExhausted) {
    const next = pTeam.value.map((w, i) => i === pActive.value ? { ...w, isKO: true } : w)
    pTeam.value = next
    statsE.value = { ko: statsE.value.ko + 1, dmg: statsE.value.dmg }
    statsERef = { ...statsE.value }
    pAnim.value   = 'wba-ko'
    message.value = `${pTeam.value[pActive.value]?.name} non ha più PP — fuori combattimento!`
    await wait(ANIM_KO_MS)
    pAnim.value   = ''
    if (next.every(w => w.isKO)) {
      setTimeout(() => { phase.value = 'defeat'; isAnim.value = false; resolveActive = false }, ANIM_ENTER_MS + 200)
      return
    }
  }

  // Fase 1: animazione entrata nuova waifu del giocatore
  pActive.value = newIdx
  lastPMove.value = null   // nuova waifu = mosse diverse: azzera il cooldown per indice
  pAnim.value   = 'wba-sL'
  message.value = `${pTeam.value[newIdx]?.name} entra in campo!`
  await wait(ANIM_ENTER_MS)
  pAnim.value   = ''
  await wait(200)

  if (!props.isPvP) {
    // Modalità CPU: valuta se anche la CPU cambia
    const { shouldSwap: cpuSwaps, swapToIdx: cpuNewIdx } =
      cpuDecideSwap([...eTeam.value], eActive.value, pTeam.value[newIdx])

    if (cpuSwaps) {
      // Entrambi cambiano — nessun attacco, turno avanza
      eActive.value = cpuNewIdx
      eAnim.value   = 'wba-sR'
      message.value = `La CPU manda in campo ${eTeam.value[cpuNewIdx]?.name}!`
      await wait(ANIM_ENTER_MS)
      eAnim.value   = ''
      await wait(200)
      message.value = 'Entrambi hanno cambiato waifu!'
      await wait(ANIM_RESULT_DELAY_MS)
    } else {
      // La CPU attacca la waifu appena entrata
      const cpuAttacker    = eTeam.value[eActive.value]
      const playerDefender = pTeam.value[newIdx]
      const eMi = cpuChooseMove(cpuAttacker, playerDefender, lastEMove.value)
      const move = cpuAttacker.moves[eMi]

      const cpuCtrl = controlEffect('enemy')
      let cpuFreed = true
      if (cpuCtrl && move) {
        message.value = `${cpuAttacker.name} è ${cpuCtrl.label}! Lancio della moneta…`
        cpuFreed = await flipCoinFor(cpuAttacker.name, cpuCtrl.label)
        if (cpuFreed) { clearControl('enemy'); message.value = `TESTA! ${cpuAttacker.name} si libera!`; await wait(500) }
        else { message.value = `CROCE… ${cpuAttacker.name} salta il turno!`; await wait(700) }
      }
      if (cpuCtrl && !cpuFreed) {
        /* turno saltato */
      } else if (move && (move.pp ?? 0) > 0) {
        eAnim.value   = 'wba-aL'
        message.value = `${cpuAttacker.name} usa ${move.name}!`
        await wait(ANIM_ENTER_MS)
        eAnim.value   = ''

        const _calc = calculateDamage(cpuAttacker, move, playerDefender)
        const { isCrit, effectiveness } = _calc
        const damage = Math.max(1, Math.round(_calc.damage * effectDamageMult('enemy')))
        pAnim.value = 'wba-sh'
        await wait(ANIM_BETWEEN_ATTACKS_MS)
        pAnim.value = ''

        const newDef = { ...playerDefender, hp: Math.max(0, playerDefender.hp - damage), isKO: (playerDefender.hp - damage) <= 0 }
        const newAtt = { ...cpuAttacker, moves: cpuAttacker.moves.map((m, i) => i === eMi ? { ...m, pp: Math.max(0, (m.pp ?? 0) - 1) } : m) }
        pTeam.value = pTeam.value.map((w, i) => i === newIdx ? newDef : w)
        eTeam.value = eTeam.value.map((w, i) => i === eActive.value ? newAtt : w)

        statsE.value = { ko: statsE.value.ko + (newDef.isKO ? 1 : 0), dmg: statsE.value.dmg + damage }
        statsERef    = { ...statsE.value }
        totalDmg.value += damage
        lastEMove.value = eMi

        if (isCrit) { message.value = 'Colpo critico! 💥'; await wait(350) }
        if (effectiveness === 'Super efficace!') { message.value = 'Super efficace!'; await wait(350) }
        else if (effectiveness === 'Efficace!') { message.value = 'Efficace!'; await wait(350) }
        else if (effectiveness === 'Poco efficace…') { message.value = 'Poco efficace…'; await wait(350) }
        else if (effectiveness === 'Non efficace') { message.value = 'Non ha effetto!'; await wait(350) }

        // Applica l'eventuale effetto della mossa CPU sulla waifu appena entrata
        if (move.effect && !newDef.isKO) applyMoveEffect('enemy', move)
        else if (move.effect && (move.effect.kind === 'buff' || move.effect.kind === 'shield')) applyMoveEffect('enemy', move)

        if (newDef.isKO) {
          message.value = `${newDef.name} è fuori combattimento!`
          pAnim.value   = 'wba-ko'
          await wait(ANIM_KO_MS)
          pAnim.value   = ''
          if (pTeam.value.every(w => w.isKO)) {
            risultatoFinale.value = { isVictory: false, statsP: { ...statsPRef }, statsE: { ...statsERef }, biggestHit: { ...biggestHitRef }, isDraw: false }
            emit('battleResult', { isVictory: false })
            setTimeout(() => { phase.value = 'result' }, ANIM_RESULT_DELAY_MS)
            resolveActive = false; isAnim.value = false; return
          }
          resolveActive = false; isAnim.value = false
          phase.value   = 'playerSwap'
          message.value = 'La tua waifu è KO! Scegli la sostituta.'
          return
        }
      }
    }
  }

  // PvP: lo swap è un'azione del turno — invia a Firestore
  if (props.isPvP) {
    const swapMoveIdx = encodeSwap(newIdx)
    pendingPMove = swapMoveIdx
    emit('pvpMoveSubmit', swapMoveIdx)
    isAnim.value    = false
    showBench.value = false
    phase.value     = 'playerChoose'
    message.value   = 'Cambio inviato! Attendo la mossa avversaria…'
    return
  }

  turn.value++
  resolveActive  = false
  isAnim.value   = false
  phase.value    = 'playerChoose'
  message.value  = 'Scegli la tua mossa!'
  timer.value    = 30
}

// ─── SCELTA MOSSA GIOCATORE ───────────────────────────────────────────────────

/** Gestisce la selezione di una mossa da parte del giocatore */
function handleMove(moveIdx: number) {
  if (isAnim.value || phase.value !== 'playerChoose') return
  if (!player.value || !enemy.value) return
  const move = player.value.moves[moveIdx]
  if (!move || (move.pp ?? 0) <= 0) return
  if (isMoveBlocked(lastPMove.value, moveIdx, move)) return

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  isAnim.value = true

  if (props.isPvP) {
    pendingPMove = moveIdx
    emit('pvpMoveSubmit', moveIdx)
    message.value = 'Mossa inviata! Attendo la mossa avversaria…'
    // Se l'avversario aveva già inviato la mossa, risolvi subito
    if (pvpOpMoveLocal != null && !resolveActive) {
      resolveTurn(moveIdx, pvpOpMoveLocal, null)
      pendingPMove = null
    }
  } else {
    // VS CPU: la CPU sceglie la mossa (salvo se ha già swappato questo turno)
    const cpuSwappedThisTurn = cpuLastVolSwapTurn + 1 === turn.value
    if (cpuSwappedThisTurn) cpuLastVolSwapTurn = -1
    const eMi = cpuSwappedThisTurn ? _CPU_SKIP : cpuChooseMove(enemy.value, player.value, lastEMove.value)
    resolveTurn(moveIdx, eMi)
  }
}

// ─── CORE LOOP: RESOLVE TURN ──────────────────────────────────────────────────

/**
 * Risolve un intero turno: ordine attacchi, animazioni, danni, KO.
 * In PvCPU usa Math.random(); in PvP usa seeded RNG (TODO quando pvpArenaEngine sarà portato).
 */
async function resolveTurn(pMi: number, eMi: number, _externalResult: null = null) {
  if (resolveActive) return
  resolveActive = true
  phase.value   = 'resolving'
  isAnim.value  = true
  showBench.value = false

  // Copia mutabile dei team per questo turno
  let curP = pTeam.value.map(w => ({ ...w, moves: [...w.moves] }))
  let curE = eTeam.value.map(w => ({ ...w, moves: [...w.moves] }))
  let cPA  = pActive.value
  let cEA  = eActive.value
  let dmgAcc = 0

  // ── Decodifica swap ────────────────────────────────────────────────────────
  const isEnemyVolSwapSkip = eMi === _CPU_SKIP
  const playerSwapIdx = decodeSwap(pMi)
  const enemySwapIdx  = isEnemyVolSwapSkip ? -1 : decodeSwap(eMi)
  const isPlayerSwap  = playerSwapIdx >= 0
  const isEnemySwap   = !isEnemyVolSwapSkip && enemySwapIdx >= 0

  // ── Esegui swap (prima degli attacchi) ────────────────────────────────────
  if (isPlayerSwap) {
    pActive.value = playerSwapIdx; cPA = playerSwapIdx
    lastPMove.value = null   // cooldown per-indice non valido sulla nuova waifu
    pAnim.value   = 'wba-sL'
    message.value = `${curP[playerSwapIdx]?.name} entra in campo!`
    await wait(ANIM_ENTER_MS)
    pAnim.value = ''
    await wait(150)
  }

  if (isEnemySwap) {
    eActive.value = enemySwapIdx; cEA = enemySwapIdx
    lastEMove.value = null   // nuova waifu CPU: nessun cooldown ereditato
    eAnim.value   = 'wba-sR'
    message.value = `${curE[enemySwapIdx]?.name} entra in campo!`
    await wait(ANIM_ENTER_MS)
    eAnim.value = ''
    await wait(150)
  }

  // Entrambi swappano: nessun attacco, turno finisce
  if (isPlayerSwap && isEnemySwap) {
    message.value = 'Entrambi hanno cambiato waifu!'
    await wait(ANIM_RESULT_DELAY_MS)
    lastPMove.value = pMi; lastEMove.value = eMi
    totalDmg.value += dmgAcc; turn.value++
    if (props.isPvP) emit('pvpTurnAdvance')
    isAnim.value   = false; resolveActive = false
    phase.value    = 'playerChoose'; message.value = 'Scegli la tua mossa!'; timer.value = 30
    return
  }

  // ── Ordine attacchi ────────────────────────────────────────────────────────
  let first: 'player' | 'enemy'
  if (isPlayerSwap) {
    first = 'enemy'
  } else if (isEnemySwap || isEnemyVolSwapSkip) {
    first = 'player'
  } else {
    const pSpd = (curP[cPA].speed ?? 50) + (Math.random() * 10 - 5)
    const eSpd = (curE[cEA].speed ?? 50) + (Math.random() * 10 - 5)
    first = pSpd >= eSpd ? 'player' : 'enemy'
  }

  // ── execAttack: esegue animazione e applica danno ─────────────────────────
  async function execAttack(side: 'player' | 'enemy', mi: number): Promise<boolean> {
    const att  = side === 'player' ? curP[cPA] : curE[cEA]
    const def  = side === 'player' ? curE[cEA] : curP[cPA]
    if (!att || !def || att.isKO) return false
    const move = att.moves[mi]
    if (!move) return false

    // Effetto control (immobilizzo/stordimento): LANCIO DELLA MONETA a inizio
    // turno — testa: l'effetto svanisce e attacca; croce: salta il turno.
    const ctrl = controlEffect(side)
    if (ctrl) {
      message.value = `${att.name} è ${ctrl.label}! Lancio della moneta…`
      const heads = await flipCoinFor(att.name, ctrl.label)
      if (heads) {
        clearControl(side)
        message.value = `TESTA! ${att.name} si libera da ${ctrl.label}!`
        await wait(600)
      } else {
        message.value = `CROCE… ${att.name} resta ${ctrl.label} e salta il turno!`
        await wait(800)
        return false
      }
    }

    const dmgCalc = calculateDamage(att, move, def)
    const { isCrit, effectiveness } = dmgCalc
    // Modificatori degli effetti attivi (buff/debuff propri, scudo del difensore)
    const effMult = effectDamageMult(side)
    // Danno PROPORZIONALE: 0 resta 0, nessun minimo forzato a 1
    const damage  = Math.max(0, Math.round(dmgCalc.damage * effMult))
    lastCritFlag = isCrit

    if (side === 'player') { pAnim.value = 'wba-aR' } else { eAnim.value = 'wba-aL' }
    message.value = `${att.name} usa ${move.name}!`
    await wait(ANIM_ATTACK_MS)
    if (side === 'player') { pAnim.value = '' } else { eAnim.value = '' }
    triggerFlash()
    // JUICE: screen-shake + vibrazione sul colpo critico
    if (isCrit && damage > 0) {
      screenShake.value = true
      setTimeout(() => { screenShake.value = false }, 420)
      try { navigator.vibrate?.(60) } catch { /* non supportato */ }
    }
    if (side === 'player') { eAnim.value = 'wba-sh' } else { pAnim.value = 'wba-sh' }
    await wait(ANIM_SHAKE_MS)
    if (side === 'player') { eAnim.value = '' } else { pAnim.value = '' }

    const newDef = { ...def, hp: Math.max(0, def.hp - damage), isKO: (def.hp - damage) <= 0 }
    const newAtt = { ...att, moves: att.moves.map((m, i) => i === mi ? { ...m, pp: Math.max(0, (m.pp ?? 0) - 1) } : m) }

    if (side === 'player') {
      curE = curE.map((w, i) => i === cEA ? newDef : w)
      curP = curP.map((w, i) => i === cPA ? newAtt : w)
    } else {
      curP = curP.map((w, i) => i === cPA ? newDef : w)
      curE = curE.map((w, i) => i === cEA ? newAtt : w)
    }
    pTeam.value = [...curP]; eTeam.value = [...curE]
    dmgAcc += damage

    // Aggiorna statistiche per lato
    const isKO = newDef.isKO
    if (side === 'player') {
      statsP.value = { ko: statsP.value.ko + (isKO ? 1 : 0), dmg: statsP.value.dmg + damage }
      statsPRef    = { ...statsP.value }
      if (isKO) {
        if (koAnimPTimer) clearTimeout(koAnimPTimer)
        koAnimPTimer = setTimeout(() => { koAnimP.value = true; setTimeout(() => { koAnimP.value = false }, 500) }, 320)
      }
    } else {
      statsE.value = { ko: statsE.value.ko + (isKO ? 1 : 0), dmg: statsE.value.dmg + damage }
      statsERef    = { ...statsE.value }
      if (isKO) {
        if (koAnimETimer) clearTimeout(koAnimETimer)
        koAnimETimer = setTimeout(() => { koAnimE.value = true; setTimeout(() => { koAnimE.value = false }, 500) }, 320)
      }
    }

    // Tracking per waifu (per MVP)
    const waifuName = att.name ?? '—'
    const waifuKey  = `${side}:${att.id ?? waifuName}`
    const imgUrl    = att.image ?? null
    const existing  = waifuStats.value[waifuKey] ?? { name: waifuName, imgUrl, kos: 0, dmg: 0, side }
    const updated   = { ...existing, dmg: existing.dmg + damage, kos: existing.kos + (isKO ? 1 : 0) }
    waifuStats.value = { ...waifuStats.value, [waifuKey]: updated }
    waifuStatsRef    = { ...waifuStats.value }

    if (damage > biggestHitRef.dmg) {
      biggestHitRef = { dmg: damage, waifuName: att.name, moveName: move.name, wasCrit: isCrit, side }
      biggestHitState.value = { ...biggestHitRef }
    }

    // Applica l'effetto della mossa (dot/control/debuff sul difensore, buff/shield su di sé)
    if (move.effect && !newDef.isKO) {
      applyMoveEffect(side, move)
    } else if (move.effect && (move.effect.kind === 'buff' || move.effect.kind === 'shield')) {
      applyMoveEffect(side, move)   // gli effetti su di sé valgono anche se il bersaglio è KO
    }

    // Messaggi efficacia
    const msgs: string[] = []
    if (isCrit) msgs.push('Colpo critico! 💥')
    if (effectiveness === 'Super efficace!') msgs.push('Super efficace!')
    else if (effectiveness === 'Efficace!') msgs.push('Efficace!')
    else if (effectiveness === 'Poco efficace…') msgs.push('Poco efficace…')
    else if (effectiveness === 'Non efficace') msgs.push('Non ha effetto!')
    if (effMult < 1 && fieldEffects.value[side === 'player' ? 'enemy' : 'player'].some(e => e.kind === 'shield')) msgs.push('Lo scudo assorbe parte del danno!')
    if (move.effect && !newDef.isKO && move.effect.kind !== 'buff' && move.effect.kind !== 'shield') msgs.push(`${newDef.name} subisce: ${move.effect.label}!`)
    // #26: log piu' lenti e leggibili (prima 250ms → non si capivano effetti/abilita').
    for (const m of msgs) { await wait(LOG_MS); message.value = m }
    if (msgs.length) await wait(Math.round(LOG_MS * 0.7)) // pausa per leggere l'ultimo

    return newDef.isKO
  }

  // Esegui primo attacco
  const firstMi = first === 'player' ? pMi : eMi
  const firstKO = await execAttack(first, firstMi)
  await wait(ANIM_BETWEEN_ATTACKS_MS)

  if (firstKO) {
    const koName = first === 'player' ? curE[cEA]?.name : curP[cPA]?.name
    message.value = `${koName} è fuori combattimento!`
    if (first === 'player') { eAnim.value = 'wba-ko' } else { pAnim.value = 'wba-ko' }
    await wait(ANIM_KO_MS)
    if (first === 'player') { eAnim.value = '' } else { pAnim.value = '' }
  } else {
    // Secondo attacco solo se nessuno dei due ha swappato
    if (!isPlayerSwap && !isEnemySwap) {
      const second   = first === 'player' ? 'enemy' : 'player'
      const secondMi = second === 'player' ? pMi : eMi
      const secondKO = await execAttack(second, secondMi)
      await wait(ANIM_BETWEEN_ATTACKS_MS)
      if (secondKO) {
        const koName2 = second === 'player' ? curE[cEA]?.name : curP[cPA]?.name
        message.value = `${koName2} è fuori combattimento!`
        if (second === 'player') { eAnim.value = 'wba-ko' } else { pAnim.value = 'wba-ko' }
        await wait(ANIM_KO_MS)
        if (second === 'player') { eAnim.value = '' } else { pAnim.value = '' }
      }
    }
  }

  // ── Tick effetti di fine turno: DoT, rigenerazione, decremento durate ──────
  for (const side of ['player', 'enemy'] as const) {
    const list = fieldEffects.value[side]
    if (!list.length) continue
    const isP  = side === 'player'
    const idx  = isP ? cPA : cEA
    const w    = (isP ? curP : curE)[idx]
    if (!w || w.isKO) { fieldEffects.value = { ...fieldEffects.value, [side]: [] }; continue }

    let hp = w.hp
    for (const e of list) {
      if (e.kind === 'dot' && (e.dannoPerTurno ?? 0) > 0) {
        hp = Math.max(0, hp - e.dannoPerTurno!)
        message.value = `${w.name} soffre per ${e.label}! -${e.dannoPerTurno} HP`
        if (isP) pAnim.value = 'wba-sh'; else eAnim.value = 'wba-sh'
        await wait(500)
        if (isP) pAnim.value = ''; else eAnim.value = ''
      } else if (e.kind === 'buff' && (e.dannoPerTurno ?? 0) > 0) {
        hp = Math.min(w.maxHp, hp + e.dannoPerTurno!)
        message.value = `${w.name} recupera ${e.dannoPerTurno} HP (${e.label})`
        await wait(500)
      }
    }

    const tickKO = hp <= 0
    const nw = { ...w, hp, isKO: tickKO }
    if (isP) { curP = curP.map((x, i) => i === idx ? nw : x); pTeam.value = [...curP] }
    else     { curE = curE.map((x, i) => i === idx ? nw : x); eTeam.value = [...curE] }

    if (tickKO) {
      // KO da DoT/effetto: accredita il punto a CHI ha inflitto l'effetto
      // (l'avversario della waifu che muore). Prima mancava → la CPU non
      // prendeva punti se ti uccideva con un danno-nel-tempo.
      if (isP) { statsE.value = { ko: statsE.value.ko + 1, dmg: statsE.value.dmg }; statsERef = { ...statsE.value } }
      else     { statsP.value = { ko: statsP.value.ko + 1, dmg: statsP.value.dmg }; statsPRef = { ...statsP.value } }
      message.value = `${w.name} è fuori combattimento!`
      if (isP) pAnim.value = 'wba-ko'; else eAnim.value = 'wba-ko'
      await wait(ANIM_KO_MS)
      if (isP) pAnim.value = ''; else eAnim.value = ''
      fieldEffects.value = { ...fieldEffects.value, [side]: [] }
    } else {
      // Decrementa la durata e rimuovi gli effetti scaduti
      const rest = list.map(e => ({ ...e, turni: e.turni - 1 })).filter(e => e.turni > 0)
      fieldEffects.value = { ...fieldEffects.value, [side]: rest }
    }
  }

  lastPMove.value = pMi; lastEMove.value = eMi
  totalDmg.value += dmgAcc; turn.value++
  if (props.isPvP) emit('pvpTurnAdvance')

  const pKO = curP[cPA]?.isKO
  const eKO = curE[cEA]?.isKO

  if (allKO(curE)) { phase.value = 'victory'; isAnim.value = false; resolveActive = false; return }
  if (allKO(curP)) { phase.value = 'defeat';  isAnim.value = false; resolveActive = false; return }

  if (eKO) {
    const nextE = nextAlive(curE, cEA)
    if (nextE < 0) { phase.value = 'victory'; isAnim.value = false; resolveActive = false; return }
    if (props.isPvP) {
      isAnim.value  = false; resolveActive = false
      phase.value   = 'pvpWaitingKoReplacement'
      message.value = "Attendi che l'avversario scelga la prossima waifu…"
      return
    }
    eActive.value = nextE; cEA = nextE
    eAnim.value   = 'wba-sR'
    message.value = `${curE[nextE]?.name} entra in campo!`
    setTimeout(() => { eAnim.value = '' }, 450)
    await wait(ANIM_ENTER_MS)
  }

  if (pKO) {
    const nextP = nextAlive(curP, cPA)
    if (nextP < 0) { phase.value = 'defeat'; isAnim.value = false; resolveActive = false; return }
    isAnim.value  = false; resolveActive = false
    phase.value   = 'playerSwap'
    message.value = 'La tua waifu è KO! Scegli la sostituta.'
    return
  }

  isAnim.value   = false; resolveActive = false
  phase.value    = 'playerChoose'; message.value = 'Scegli la tua mossa!'; timer.value = 30
}

// ─── SWAP FORZATO DOPO KO ─────────────────────────────────────────────────────

/** Gestisce il cambio forzato dopo un KO del giocatore */
function handlePlayerSwap(newIdx: number) {
  pActive.value = newIdx
  lastPMove.value = null   // nuova waifu: nessun cooldown ereditato
  pAnim.value   = 'wba-sL'
  setTimeout(() => { pAnim.value = '' }, 450)
  resolveActive  = false
  phase.value    = 'playerChoose'
  message.value  = `${pTeam.value[newIdx]?.name} entra in campo! Scegli la mossa!`
  timer.value    = 30
  if (props.isPvP) emit('pvpKoReplacement', newIdx)
}

/** Chiude il popup risultato */
function handleResultContinue(choice: string | null = null) {
  emit('exit', choice)
}

// ─── STATO DERIVATO UI ────────────────────────────────────────────────────────

const isChoose        = computed(() => phase.value === 'playerChoose')
const isSwap          = computed(() => phase.value === 'playerSwap')
const isVolSwap       = computed(() => phase.value === 'voluntarySwap')
const isWaitingKoRepl = computed(() => phase.value === 'pvpWaitingKoReplacement')
const allPPOut        = computed(() => (player.value?.moves ?? []).every(m => (m.pp ?? 0) <= 0))

// ── Menù azioni pre-mosse: MOSSE / WAIFU / ABBANDONA ─────────────────────────
// Sostituisce la vecchia riga panchina sopra la griglia: si sceglie prima
// l'azione, poi si vede la griglia mosse o lo slideover di cambio.
const actionMenu = ref<'menu' | 'moves'>('menu')
watch(isChoose, (v) => { if (v) actionMenu.value = 'menu' })
// WAIFU è disabilitato SOLO se non c'è un'altra waifu viva da mandare in campo
// (o se non è il mio turno di scelta). NIENTE blocco al primo turno.
const swapDisabled = computed(() =>
  !isChoose.value || isAnim.value || (props.isPvP && props.pvpWaiting)
  || !pTeam.value.some((w, i) => i !== pActive.value && !w.isKO))

// ── Long-press su uno slot del cambio: dettaglio waifu (tipo + mosse) ──
const swapDetail = ref<WaifuBattleStat | null>(null)
let swapLpTimer: ReturnType<typeof setTimeout> | null = null
let swapLpFired = false
function swapPressStart(w: WaifuBattleStat) {
  swapLpFired = false
  if (swapLpTimer) clearTimeout(swapLpTimer)
  swapLpTimer = setTimeout(() => { swapLpFired = true; swapDetail.value = w }, 420)
}
function swapPressEnd() {
  if (swapLpTimer) { clearTimeout(swapLpTimer); swapLpTimer = null }
}
/** true se il tap era un long-press: il click di selezione va ignorato */
function consumeSwapLongPress(): boolean {
  const fired = swapLpFired
  swapLpFired = false
  return fired
}

// Abbandona: popup di conferma → 'Sì' chiude subito la partita con la sconfitta
const confirmQuit = ref(false)
function quitBattle() {
  confirmQuit.value = false
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  isAnim.value = false
  resolveActive = false
  phase.value = 'defeat'
}
// Chiude il popup cambio volontario senza cambiare e torna alla scelta mossa
function cancelVoluntarySwap() {
  if (phase.value !== 'voluntarySwap') return
  showBench.value = false
  phase.value   = 'playerChoose'
  message.value = 'Scegli la tua mossa!'
}

const sEnemy  = computed(() => isMobile.value ? 118 : 150)
const sPlayer = computed(() => isMobile.value ? 130 : 168)

const playerGlow = computed(() => isChoose.value && !isAnim.value
  ? '0 12px 40px rgba(0,0,0,.75), 0 0 0 2px #00C8FF, 0 0 22px rgba(0,200,255,.38)'
  : '0 12px 40px rgba(0,0,0,.75)',
)

// Colori adattivi light/dark
const c = computed(() => isDark.value ? {
  teal:      '#6cf0e0',
  tealMid:   'rgba(108,240,224,0.6)',
  tealFaint: 'rgba(108,240,224,0.5)',
  pink:      '#ff85b6',
  pinkFaint: 'rgba(255,133,182,0.5)',
  gold:      '#f5c560',
  goldFaint: 'rgba(245,197,96,0.7)',
  green:     '#00e676',
  orange:    '#f5a623',
  yellow:    '#ffd666',
  neutral:   'rgba(238,232,220,.38)',
} : {
  teal:      '#0891b2',
  tealMid:   '#0891b2',
  tealFaint: '#0891b2',
  pink:      '#db2777',
  pinkFaint: '#db2777',
  gold:      '#B07D00',
  goldFaint: '#B07D00',
  green:     '#16a34a',
  orange:    '#c2410c',
  yellow:    '#B07D00',
  neutral:   'var(--theme-text-3)',
})

const timerCol  = computed(() => timer.value <= 5 ? '#ff2d2d' : timer.value <= 10 ? '#ff8800' : c.value.yellow)
const timerSize = computed(() => timer.value <= 5 ? 26 : timer.value <= 10 ? 22 : 18)
const timerAnim = computed(() => timer.value <= 5 ? 'timerUrg .5s ease-in-out infinite' : 'none')
const timerBg   = computed(() => timer.value <= 5
  ? 'rgba(255,45,45,0.15)' : timer.value <= 10
  ? 'rgba(255,136,0,0.12)' : 'rgba(0,0,0,0.08)')

const turnLabel = computed(() => {
  if (isChoose.value)        return `TURNO ${turn.value}`
  if (isSwap.value || isVolSwap.value) return 'SCEGLI WAIFU'
  if (isWaitingKoRepl.value) return 'ATTESA SOSTITUTA…'
  if (props.isPvP && props.pvpWaiting) return 'ATTESA…'
  if (phase.value === 'entering')      return 'INIZIO'
  return 'RISOLUZIONE'
})
// Icona turno — affiancata al label (Lucide invece di emoji)
const turnIcon = computed(() => {
  if (isChoose.value)        return Swords
  if (isSwap.value || isVolSwap.value) return Zap
  return Zap
})
const turnCol = computed(() =>
  isChoose.value ? c.value.green : (isSwap.value || isVolSwap.value) ? c.value.orange : c.value.neutral,
)

// Colori HP adattivi
function hpPlayerCol() { return isDark.value ? '#6cf0e0' : '#0891b2' }
function hpEnemyCol()  { return isDark.value ? '#ff85b6' : '#db2777' }

// ─── HELPER: HP BAR COLORI ────────────────────────────────────────────────────

function hpBarBg(pct: number, side: 'player' | 'enemy' | 'neutral'): string {
  if (side === 'player') return 'linear-gradient(90deg, #6cf0e0, #a78bfa)'
  if (side === 'enemy')  return 'linear-gradient(90deg, #ff85b6, #a78bfa)'
  return pct > 50 ? '#00e676' : pct > 25 ? '#ffd666' : '#ff4d4d'
}
function hpNumCol(pct: number, side: 'player' | 'enemy' | 'neutral'): string {
  if (side === 'player') return hpPlayerCol()
  if (side === 'enemy')  return hpEnemyCol()
  return pct > 50 ? c.value.green : pct > 25 ? c.value.yellow : '#ff4d4d'
}

// ─── HELPER: EFFICACIA MOSSA ─────────────────────────────────────────────────

interface EffDisplay { col: string; lbl: string; bold: boolean }
const _HIGHLIGHT_COLORS: Record<string, string> = {
  Arcana: '#C5BFFF', Natura: '#A8E84A', Abisso: '#FF80AA', Ferro: '#64748b', Fuoco: '#FF8C50',
}

function getEffDisplay(moveType: string, enemyType: string, playerType: string): EffDisplay {
  const { label } = getEffectiveness(moveType, playerType, enemyType)
  const col = (_TYPE_COLORS_UI[moveType] ?? TYPE_COLORS[moveType])?.border ?? '#9ca3af'
  // #14: label compatte così la chip non sfora la card (2 super-efficaci in riga)
  if (label === 'Super efficace!') return { col, lbl: 'Super eff.', bold: true }
  if (label === 'Efficace!')       return { col, lbl: 'Efficace',   bold: true }
  if (label === 'Poco efficace…')  return { col, lbl: 'Poco eff.',  bold: true }
  if (label === 'Non efficace')    return { col, lbl: 'Non eff.',   bold: true }
  return { col, lbl: 'Normale', bold: false }
}

// ─── MVP (risultato) ──────────────────────────────────────────────────────────

const mvp = computed(() => {
  if (!risultatoFinale.value?.waifuStats) return null
  const all = Object.values(risultatoFinale.value.waifuStats)
  if (!all.length) return null
  return all.sort((a, b) => b.dmg - a.dmg || b.kos - a.kos)[0]
})
</script>

<template>
  <!-- Popup risultato finale: mostrato al termine della battaglia -->
  <template v-if="phase === 'result' && risultatoFinale">
    <div
      :style="{
        position:'fixed',inset:0,zIndex:50,
        background:'var(--theme-overlay)',backdropFilter:'blur(8px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'16px',overflowY:'auto',
      }"
    >
      <div class="wba-fm" :style="{
        background:'var(--theme-surface)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
        border:`1px solid ${!risultatoFinale.isDraw && risultatoFinale.isVictory ? 'rgba(245,197,96,0.5)' : risultatoFinale.isDraw ? 'rgba(167,139,250,0.35)' : 'rgba(255,133,182,0.35)'}`,
        borderRadius:'20px',padding:'22px 20px',maxWidth:'380px',width:'100%',textAlign:'center',margin:'auto',
      }">
        <!-- Icona esito — Lucide: Handshake pareggio, Crown vittoria, HeartCrack sconfitta -->
        <div :style="{ marginBottom:'6px', display:'flex', justifyContent:'center' }">
          <Handshake v-if="risultatoFinale.isDraw"   :size="44" stroke-width="1.5" style="color:#a78bfa;" />
          <Crown     v-else-if="risultatoFinale.isVictory" :size="44" stroke-width="1.5" style="color:#f5c560;" />
          <HeartCrack v-else                         :size="44" stroke-width="1.5" style="color:#ff85b6;" />
        </div>

        <!-- (Bo3 rimosso: ora le battaglie sono a round singolo) -->

        <!-- VITTORIA / SCONFITTA / PAREGGIO -->
        <div :style="{
          fontFamily:'var(--ff-display)',fontSize:'22px',fontWeight:900,
          color: risultatoFinale.isDraw ? '#a78bfa' : risultatoFinale.isVictory ? c.gold : c.pink,
          letterSpacing:'2px',marginBottom:'8px',
        }">
          {{ risultatoFinale.isDraw ? 'PAREGGIO' : risultatoFinale.isVictory ? 'VITTORIA!' : 'SCONFITTA' }}
        </div>

        <!-- Punteggio round (nascosto nei raid: il punteggio 1-1 non ha senso) -->
        <div v-if="!risultatoFinale.isDraw && !battleCtx?.isRaid" :style="{
          marginBottom:'10px',padding:'10px 16px',
          background:'linear-gradient(135deg,rgba(167,139,250,0.12),rgba(255,133,182,0.08))',
          border:'1px solid rgba(167,139,250,0.3)',borderRadius:'12px',
        }">
          <div :style="{ display:'flex',alignItems:'center',justifyContent:'center',gap:'14px',marginBottom:'8px' }">
            <div :style="{ textAlign:'center' }">
              <div :style="{ fontFamily:'var(--ff-display)',fontSize:'28px',fontWeight:900,color:c.teal,lineHeight:1 }">
                {{ risultatoFinale.statsP.ko }}
              </div>
              <div :style="{ fontFamily:'var(--ff-label)',fontSize:'13px',color:c.teal,textTransform:'uppercase',marginTop:'2px',fontWeight:700 }">
                {{ (battleCtx?.nomeImpero as string) || 'Tu' }}
              </div>
            </div>
            <div :style="{ fontFamily:'var(--ff-label)',fontSize:'20px',color:'var(--theme-text-3)',fontWeight:700 }">–</div>
            <div :style="{ textAlign:'center' }">
              <div :style="{ fontFamily:'var(--ff-display)',fontSize:'28px',fontWeight:900,color:c.pink,lineHeight:1 }">
                {{ risultatoFinale.statsE.ko }}
              </div>
              <div :style="{ fontFamily:'var(--ff-label)',fontSize:'13px',color:c.pink,textTransform:'uppercase',marginTop:'2px',fontWeight:700 }">
                {{ (battleCtx?.nomeImperoAvversario as string) || 'CPU' }}
              </div>
            </div>
          </div>
          <div :style="{ fontFamily:'var(--ff-body)',fontSize:'12px',color:'var(--theme-text)',textAlign:'center',lineHeight:1.4 }">
            <span :style="{ color: risultatoFinale.isVictory ? c.teal : c.pink, fontWeight:700 }">
              {{ risultatoFinale.isVictory ? ((battleCtx?.nomeImpero as string) || 'Tu') : ((battleCtx?.nomeImperoAvversario as string) || 'CPU') }}
            </span>
            {{ ' ' }}ha sconfitto{{ ' ' }}
            <span :style="{ color: risultatoFinale.isVictory ? c.pink : c.teal, fontWeight:700 }">
              {{ risultatoFinale.isVictory ? ((battleCtx?.nomeImperoAvversario as string) || 'CPU') : ((battleCtx?.nomeImpero as string) || 'Tu') }}
            </span>
          </div>
        </div>

        <!-- Info partita -->
        <div :style="{ textAlign:'left',padding:'8px 4px',marginBottom:'12px',borderTop:'1px solid var(--theme-border)',borderBottom:'1px solid var(--theme-border)' }">
          <div v-for="row in [
            { l:'Turni', v: turn, c: c.orange },
            { l:'Danno tuoi', v: risultatoFinale.statsP.dmg, c: c.teal },
            { l:'Danno Avversario', v: risultatoFinale.statsE.dmg, c: c.pink },
          ]" :key="row.l" :style="{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0' }">
            <span :style="{ fontFamily:'var(--ff-body)',fontSize:'15px',fontWeight:600,color:'var(--theme-text-2)' }">{{ row.l }}</span>
            <span :style="{ fontFamily:'var(--ff-label)',fontSize:'18px',fontWeight:800,color:row.c }">{{ row.v }}</span>
          </div>
        </div>

        <!-- MVP -->
        <div v-if="mvp" :style="{
          display:'flex',alignItems:'center',gap:'10px',
          background: mvp.side === 'player' ? 'rgba(108,240,224,0.06)' : 'rgba(255,133,182,0.06)',
          border:`1px solid ${mvp.side === 'player' ? 'rgba(245,197,96,0.35)' : 'rgba(255,133,182,0.3)'}`,
          borderRadius:'12px',padding:'8px 12px',marginBottom:'12px',
        }">
          <div :style="{ position:'relative',flexShrink:0 }">
            <div :style="{
              width:'68px',height:'96px',borderRadius:'10px',overflow:'hidden',
              background:'var(--theme-bg-secondary)',display:'flex',alignItems:'center',justifyContent:'center',
              border:`2px solid ${mvp.side === 'player' ? 'rgba(245,197,96,0.6)' : 'rgba(255,133,182,0.5)'}`,
            }">
              <img v-if="mvp.imgUrl" :src="ikUrl(mvp.imgUrl, 'thumbnail') ?? ''" :alt="mvp.name"
                :style="{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top' }"/>
              <span v-else :style="{ fontSize:'20px',opacity:.25 }">◈</span>
            </div>
            <Crown :size="16" stroke-width="1.5" style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);color:#f5c560;" />
          </div>
          <div :style="{ flex:1,minWidth:0,textAlign:'left' }">
            <div :style="{ fontFamily:'var(--ff-label)',fontSize:'13px',color:c.goldFaint,letterSpacing:'1.5px',marginBottom:'3px',fontWeight:700 }">
              MVP · {{ mvp.side === 'player' ? ((battleCtx?.nomeImpero as string) || 'TU') : ((battleCtx?.nomeImperoAvversario as string) || 'CPU') }}
            </div>
            <div :style="{ fontFamily:'var(--ff-display)',fontSize:'18px',fontWeight:900,color:c.gold,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:'5px' }">
              {{ mvp.name }}
            </div>
            <div :style="{ fontFamily:'var(--ff-label)',fontSize:'18px',fontWeight:900,color:c.gold }">
              {{ mvp.dmg.toLocaleString() }} <span :style="{ fontSize:'13px',color:c.goldFaint,fontFamily:'var(--ff-label)' }">DMG</span>
            </div>
          </div>
        </div>

        <!-- Bottoni azione finale -->
        <div :style="{ display:'flex',gap:'8px',width:'100%' }">
          <button
            @click="handleResultContinue(null)"
            :style="{
              padding:'14px 10px',flex:1,borderRadius:'999px',cursor:'pointer',
              fontFamily:'var(--ff-label)',
              fontSize:'15px',fontWeight:700,letterSpacing:'1.4px',textTransform:'uppercase',
              width:'100%',
              background:'var(--theme-accent)',
              border:'none',
              color:'#fff',
              boxShadow:'rgba(245,197,96,0.35) 0px 6px 20px 0px',
            }"
          >
            VAI ALLA MAPPA →
          </button>
        </div>
      </div>
    </div>
  </template>

  <!-- Arena di battaglia principale -->
  <template v-else-if="phase !== 'result'">
    <div :style="{
      position:'fixed',
      top: `${topOffset}px`, left:0, right:0, bottom: `${bottomOffset}px`,
      zIndex:40, overflowY:'auto',
      background:'var(--theme-bg)',
      display:'flex', flexDirection:'column',
      paddingBottom:'env(safe-area-inset-bottom,12px)',
    }">

      <!-- Flash schermo bianco -->
      <div v-if="showFlash" :style="{
        position:'absolute',inset:0,zIndex:99,
        background:'rgba(255,255,255,.78)',
        animation:'flash .22s ease-out forwards',
        pointerEvents:'none',
      }"/>

      <!-- Floating damage numbers -->
      <div
        v-for="f in dmgFloats"
        :key="f.id"
        :style="{
          position:'absolute',
          left: f.side === 'enemy' ? '62%' : '22%',
          top:  f.side === 'enemy' ? '22%'  : '52%',
          zIndex:30, pointerEvents:'none',
          display:'flex', flexDirection:'column', alignItems:'center',
          animation:'floatDmg 1.3s ease-out forwards',
          userSelect:'none',
        }"
      >
        <span :style="{
          fontFamily:'var(--ff-label)', fontWeight:900,
          fontSize: `${Math.min(56, Math.max(30, Math.round(f.dmg / 6) + 24))}px`,
          color: f.isCrit ? '#f5a623' : '#fff',
          textShadow: f.isCrit
            ? '0 2px 12px rgba(0,0,0,.9),0 0 22px rgba(245,166,35,.6)'
            : '0 2px 12px rgba(0,0,0,.9),0 0 18px rgba(255,255,255,.25)',
          letterSpacing:'1px',
        }">-{{ f.dmg }}</span>
        <span v-if="f.isCrit" :style="{
          fontFamily:'var(--ff-label)', fontWeight:700, fontSize:'12px',
          color:'#f5a623', letterSpacing:'1.5px', marginTop:'2px',
        }">CRITICAL HIT!</span>
      </div>

      <!-- ── ZONA 1: Header compatto — altezza FISSA: il timer che appare/scompare
           non deve far alzare/abbassare tutta l'arena ── -->
      <div :style="{
        flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 10px', height:'46px',
        background:'var(--theme-surface)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
        borderBottom:'0.8px solid rgba(167,139,250,0.2)',
      }">
        <span :style="{
          fontFamily:'var(--ff-display)',
          fontSize: isMobile ? '13px' : '16px', fontWeight:700, color:turnCol,
          minWidth: isMobile ? '64px' : '80px',
        }"><component :is="turnIcon" :size="isMobile ? 11 : 14" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:4px;" />{{ turnLabel }}</span>

        <!-- Score KO al centro -->
        <div :style="{
          display:'flex', alignItems:'center', gap: isMobile ? '6px' : '10px',
          background:'var(--theme-shimmer)', borderRadius:'8px',
          padding: isMobile ? '2px 8px' : '3px 12px',
        }">
          <div :style="{ textAlign:'center' }">
            <div :class="koAnimP ? 'wba-score-pop' : ''"
              :style="{ fontFamily:'var(--ff-label)',fontWeight:900,fontSize: isMobile ? '16px' : '20px',color:c.teal,lineHeight:1 }">
              {{ statsP.ko }}
            </div>
          </div>
          <div :style="{ fontFamily:'var(--ff-label)',fontSize: isMobile ? '13px' : '13px',color:'rgba(238,232,220,.25)',fontWeight:700 }">—</div>
          <div :style="{ textAlign:'center' }">
            <div :class="koAnimE ? 'wba-score-pop' : ''"
              :style="{ fontFamily:'var(--ff-label)',fontWeight:900,fontSize: isMobile ? '16px' : '20px',color:c.pink,lineHeight:1 }">
              {{ statsE.ko }}
            </div>
          </div>
        </div>

        <!-- Badge PvP -->
        <span v-if="isPvP" :style="{
          fontFamily:'var(--ff-label)',fontSize:'12px',color:'rgba(155,89,255,.55)',letterSpacing:'1px',
          border:'1px solid rgba(155,89,255,.25)',borderRadius:'4px',padding:'2px 6px',
        }">PVP</span>

        <!-- Timer — SEMPRE renderizzato (visibility) e con box ad altezza fissa:
             la sua comparsa/scomparsa non cambia più l'altezza dell'header -->
        <div :style="{
          fontFamily:'var(--ff-display)', fontWeight:900,
          fontSize: `${timerSize}px`, color:timerCol, lineHeight:1,
          animation: isChoose ? timerAnim : 'none', transformOrigin:'center',
          background:timerBg,
          borderRadius:'999px', padding:'0 12px',
          border:`1.5px solid ${timerCol}55`,
          minWidth:'72px', height:'34px',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'color 0.3s, background 0.3s',
          visibility: isChoose ? 'visible' : 'hidden',
        }">
          ⏱ {{ timer }}s
        </div>
      </div>

      <!-- ── BARRA HP BOSS (raid): prominente, full-width, dorata/rossa ── -->
      <div v-if="isBoss && enemy" class="wba-boss-bar">
        <div class="wba-boss-bar__label">
          <span class="wba-boss-bar__badge">BOSS</span>
          <span class="wba-boss-bar__name">{{ enemy.name }}</span>
          <span class="wba-boss-bar__pct">{{ enemy.hp > 0 ? Math.max(1, Math.round(bossHpPct)) : 0 }}%</span>
        </div>
        <div class="wba-boss-bar__track">
          <div class="wba-boss-bar__fill" :style="{ width: bossHpPct + '%' }" />
        </div>
        <div class="wba-boss-bar__value">{{ Math.max(0, Math.round(enemy.hp)) }} / {{ enemy.maxHp }} HP</div>
      </div>

      <!-- ── ZONE 2+3+4: Arene di battaglia ── -->
      <div :class="{ 'wba-screenshake': screenShake }" :style="{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', minHeight:0 }">

        <!-- Enemy Zone (top ~47% mobile, 52% desktop) -->
        <div :style="{ flex: isMobile ? '0 0 47%' : '0 0 52%', position:'relative', overflow:'hidden' }">
          <!-- HUD nemico: top-left (nascosto nei raid: la barra HP boss in alto lo sostituisce) -->
          <div :style="{ position:'absolute', top:'15px', left:'12px', zIndex:3, display:'flex', flexDirection:'column', alignItems:'flex-start' }">
            <template v-if="enemy && !isBoss">
              <!-- EnemyHud inline — specchia il layout del player HUD -->
              <div :style="{
                background:'var(--theme-surface)', backdropFilter:'blur(12px)',
                border:'1.5px solid rgba(255,50,80,.5)', borderRadius:'14px',
                padding:'10px 14px', maxWidth:'56%', minWidth:'150px',
                boxShadow:'0 2px 12px var(--theme-shadow)', position:'relative',
              }">
                <!-- Chip tipo — top-right assoluto, full-round -->
                <div v-if="!enemy._hotBlurred" :style="{
                  position:'absolute', top:'-12px', right:'-8px',
                  background:'var(--theme-surface)',
                  color:(_TYPE_COLORS_UI[enemy.type] ?? { border:'#555' }).border,
                  border:`1.5px solid ${(_TYPE_COLORS_UI[enemy.type] ?? { border:'#555' }).border}`,
                  borderRadius:'999px', padding:'3px 12px',
                  fontSize:'13px', fontWeight:800,
                  fontFamily:'var(--ff-label)',
                  backdropFilter:'blur(4px)',
                }">{{ enemy.type }}</div>
                <div v-else :style="{
                  position:'absolute', top:'-12px', right:'-8px',
                  background:'var(--theme-surface)',
                  color:'#ff85b6', border:'1.5px solid #ff85b6',
                  borderRadius:'999px', padding:'3px 10px',
                  fontSize:'13px', fontWeight:800,
                  fontFamily:'var(--ff-label)',
                  display:'flex', alignItems:'center', gap:'4px',
                }"><Flame :size="12" stroke-width="1.5" />HOT</div>

                <!-- Nome grande -->
                <div :style="{
                  fontFamily:'var(--ff-display)', fontSize:'18px', fontWeight:900,
                  color: enemy._hotBlurred ? 'rgba(255,133,182,0.7)' : 'var(--theme-text)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'6px', paddingRight:'4px',
                }">{{ enemy._hotBlurred ? '???' : enemy.name }}</div>

                <!-- HpBar -->
                <div :style="{ height:'8px',background:'var(--theme-border)',borderRadius:'8px',overflow:'hidden',marginBottom:'5px' }">
                  <div :class="enemy.maxHp > 0 && (enemy.hp / enemy.maxHp) * 100 <= 25 && enemy.hp > 0 ? 'wba-hp-crit' : ''"
                    :style="{
                      width:`${enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0}%`,
                      height:'100%',
                      background:hpBarBg(enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0, 'enemy'),
                      borderRadius:'8px', transition:'width .6s cubic-bezier(.25,.8,.25,1)',
                    }"
                  />
                </div>

                <!-- HP% bottom-left, grande -->
                <div :style="{ display:'flex',alignItems:'baseline',gap:'2px' }">
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'20px',fontWeight:900,color:c.pink }">
                    {{ enemy.maxHp > 0 ? (enemy.hp > 0 ? Math.max(1, Math.round((enemy.hp / enemy.maxHp) * 100)) : 0) : 0 }}%
                  </span>
                </div>

              </div>

              <!-- Effetti di stato: SOPRA alla card, impilati uno sopra l'altro -->
              <div v-if="fieldEffects.enemy.length" :style="{ order:-1, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'4px', marginBottom:'6px' }">
                <span v-for="e in fieldEffects.enemy" :key="e.status" :style="effectChipStyle(e)">
                  <span style="font-size:12px;line-height:1;">{{ effectIcon(e) }}</span>
                  <span>{{ e.label }}<template v-if="(e.dannoPerTurno ?? 0) > 0"> −{{ e.dannoPerTurno }}/t</template> · {{ e.turni }}t</span>
                </span>
              </div>
            </template>
          </div>

          <!-- Waifu rimanenti avversario — stile "pokeball" (solo team multiplo, non boss) -->
          <div v-if="!isBoss && eTeam.length > 1" :style="{ position:'absolute', top:'15px', right:'12px', zIndex:3, display:'flex', gap:'6px' }">
            <div v-for="(w, i) in eTeam" :key="w.id"
              :title="w.name"
              :style="{
                width:'14px', height:'14px', borderRadius:'50%',
                background: w.isKO ? 'transparent' : '#ff4d6a',
                border:`2px solid ${w.isKO ? 'rgba(255,255,255,0.28)' : '#ff4d6a'}`,
                boxShadow: (!w.isKO && i === eActive) ? '0 0 7px #ff4d6a' : 'none',
                opacity: w.isKO ? 0.45 : 1,
                transition:'all .3s',
              }" />
          </div>


          <!-- Sprite nemico: centrato verticalmente, a destra. Durante l'attacco (zoom) sale sopra a tutto. -->
          <div :style="{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', zIndex: eAnim === 'wba-aL' ? 60 : 2 }">
            <!-- WaifuSprite inline nemico -->
            <template v-if="enemy">
              <div :class="eAnim" @click="openWaifuDetail(enemy, 'enemy')" :style="{
                width:`${sEnemy}px`, aspectRatio:'2/3', borderRadius:'12px', overflow:'hidden',
                background: getRarityCardBg(enemy.rarita),
                border:`2px solid ${(TYPE_COLORS[enemy.type]?.border ?? '#444')}66`,
                boxShadow:'0 8px 28px rgba(0,0,0,.65)',
                position:'relative', flexShrink:0, cursor:'pointer',
                transform:'perspective(320px) rotateY(-4deg)',
              }">
                <img v-if="enemy.image" :src="ikUrl(enemy.image, 'normal') ?? ''" :alt="enemy.name"
                  :style="{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top', filter: enemy._hotBlurred ? 'blur(6px)' : 'none' }"/>
                <div v-else :style="{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'6px' }">
                  <div :style="{ fontSize:'28px',opacity:.2 }">◈</div>
                  <div :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',color:'var(--theme-text-3)',textAlign:'center',padding:'0 6px',lineHeight:1.3 }">{{ enemy.name }}</div>
                </div>
                <!-- Foil epico/leggendario/immersivo -->
                <div v-if="FOIL_RARITIES.includes(enemy.rarita?.toLowerCase())" :style="{
                  position:'absolute',inset:0,borderRadius:'inherit',
                  background:'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 6px, transparent 6px, transparent 14px)',
                  pointerEvents:'none',
                }"/>
                <!-- Overlay KO -->
                <div v-if="enemy.isKO" :style="{
                  position:'absolute',inset:0,background:'rgba(0,0,0,.72)',
                  display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)',
                }">
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'20px',color:'#ff4d4d',fontWeight:900,letterSpacing:'2px',textShadow:'0 0 16px #ff4d4d88' }">KO</span>
                </div>
                <!-- Overlay Hot -->
                <div v-if="enemy._hotBlurred && !enemy.isKO" :style="{
                  position:'absolute',inset:0,background:'rgba(3,2,12,0.55)',
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',
                  pointerEvents:'none',
                }">
                  <Flame :size="20" stroke-width="1.5" style="color:#ff85b6;" />
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',color:'#ff85b6',letterSpacing:'1px',fontWeight:700 }">HOT</span>
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',color:'rgba(255,133,182,0.65)',letterSpacing:'0.5px' }">Pass Hard</span>
                </div>
              </div>
            </template>
          </div>

          <!-- Vignetta rossa lato nemico -->
          <div :style="{
            position:'absolute',inset:0,
            background:'radial-gradient(ellipse at 75% 30%, rgba(200,20,40,.07) 0%, transparent 70%)',
            pointerEvents:'none',zIndex:1,
          }"/>
        </div>

        <!-- Message Bar -->
        <div :style="{
          flexShrink:0, minHeight: isMobile ? '28px' : '40px', maxHeight:'40px',
          display:'flex', alignItems:'center', padding:'0 12px',
          background:'var(--theme-surface)',
          borderTop:'1px solid var(--theme-border)',
          borderBottom:'1px solid var(--theme-border)',
        }">
          <p :key="message" class="wba-fm" :style="{
            fontFamily:'var(--ff-body)', fontSize: isMobile ? '14px' : '15px', color:'var(--theme-text)',
            margin:0, lineHeight:1.3, overflow:'hidden',
            display:'-webkit-box', WebkitLineClamp:'1', WebkitBoxOrient:'vertical',
          }">{{ message }}</p>
        </div>

        <!-- Banner Hot waifu nemica -->
        <div v-if="enemy?._hotBlurred" :style="{
          flexShrink:0, padding:'5px 12px',
          background:'rgba(255,133,182,0.1)', borderBottom:'1px solid rgba(255,133,182,0.2)',
          display:'flex', alignItems:'center', gap:'6px',
        }">
          <Flame :size="12" stroke-width="1.5" style="color:#ff85b6;flex-shrink:0;" />
          <span :style="{ fontFamily:'var(--ff-body)',fontSize:'12px',color:'rgba(255,133,182,0.85)',flex:1 }">
            Questa waifu è Hot e non puoi vederla. Acquista il Pass Hard per scoprirla.
          </span>
        </div>

        <!-- Player Zone (bottom) -->
        <div :style="{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }">
          <!-- Vignetta blu lato giocatore -->
          <div :style="{
            position:'absolute',inset:0,
            background:'radial-gradient(ellipse at 25% 70%, rgba(0,120,200,.07) 0%, transparent 70%)',
            pointerEvents:'none',zIndex:1,
          }"/>

          <!-- Sprite giocatore: centrato verticalmente, a sinistra. Durante l'attacco (zoom) sale sopra a tutto. -->
          <div :style="{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', zIndex: pAnim === 'wba-aR' ? 60 : 2 }">
            <template v-if="player">
              <div :class="pAnim" @click="openWaifuDetail(player, 'player')" :style="{
                width:`${sPlayer}px`, aspectRatio:'2/3', borderRadius:'12px', overflow:'hidden',
                background: getRarityCardBg(player.rarita),
                border:`2px solid ${(TYPE_COLORS[player.type]?.border ?? '#444')}66`,
                boxShadow: playerGlow,
                position:'relative', flexShrink:0, cursor:'pointer',
                transform:'perspective(320px) rotateY(4deg)',
              }">
                <img v-if="player.image" :src="ikUrl(player.image, 'normal') ?? ''" :alt="player.name"
                  :style="{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top' }"/>
                <div v-else :style="{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'6px' }">
                  <div :style="{ fontSize:'28px',opacity:.2 }">◈</div>
                  <div :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',color:'var(--theme-text-3)',textAlign:'center',padding:'0 6px',lineHeight:1.3 }">{{ player.name }}</div>
                </div>
                <div v-if="FOIL_RARITIES.includes(player.rarita?.toLowerCase())" :style="{
                  position:'absolute',inset:0,borderRadius:'inherit',
                  background:'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 6px, transparent 6px, transparent 14px)',
                  pointerEvents:'none',
                }"/>
                <div v-if="player.isKO" :style="{
                  position:'absolute',inset:0,background:'rgba(0,0,0,.72)',
                  display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)',
                }">
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'20px',color:'#ff4d4d',fontWeight:900,letterSpacing:'2px',textShadow:'0 0 16px #ff4d4d88' }">KO</span>
                </div>
              </div>
            </template>
          </div>

          <!-- HUD giocatore: TOP-right (dentro la sezione utente), compatto -->
          <div :style="{ position:'absolute', right:'12px', top:'12px', zIndex:3, display:'flex', flexDirection:'column', alignItems:'flex-end' }">
            <template v-if="player">
              <div :style="{
                background:'var(--theme-surface)', backdropFilter:'blur(12px)',
                border:'1.5px solid rgba(0,180,255,.5)', borderRadius:'12px',
                padding:'7px 11px', maxWidth:'54%', minWidth:'128px',
                boxShadow:'0 2px 12px var(--theme-shadow)', position:'relative',
              }">
                <!-- Chip tipo — top-right assoluto, full-round -->
                <div :style="{
                  position:'absolute', top:'-10px', right:'-6px',
                  background:'var(--theme-surface)',
                  color:(_TYPE_COLORS_UI[player.type] ?? { border:'#555' }).border,
                  border:`1.5px solid ${(_TYPE_COLORS_UI[player.type] ?? { border:'#555' }).border}`,
                  borderRadius:'999px', padding:'2px 9px',
                  fontSize:'10px', fontWeight:800,
                  fontFamily:'var(--ff-label)',
                  backdropFilter:'blur(4px)',
                }">{{ player.type }}</div>

                <!-- Nome -->
                <div :style="{ fontFamily:'var(--ff-display)',fontSize:'13px',fontWeight:900,color:'var(--theme-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:'5px',paddingRight:'4px' }">
                  {{ player.name }}
                </div>

                <!-- HpBar -->
                <div :style="{ height:'6px',background:'var(--theme-border)',borderRadius:'8px',overflow:'hidden',marginBottom:'4px' }">
                  <div
                    :class="player.maxHp > 0 && (player.hp / player.maxHp) * 100 <= 25 && player.hp > 0 ? 'wba-hp-crit' : ''"
                    :style="{
                      width:`${player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0}%`,
                      height:'100%',
                      background: hpBarBg(player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0, 'player'),
                      borderRadius:'8px', transition:'width .6s cubic-bezier(.25,.8,.25,1)',
                    }"
                  />
                </div>

                <!-- HP -->
                <div :style="{ display:'flex',alignItems:'baseline',gap:'2px' }">
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'15px',fontWeight:900,color:c.teal }">{{ Math.max(0, player.hp) }}</span>
                  <span :style="{ fontFamily:'var(--ff-label)',fontSize:'11px',color:'var(--theme-text-3)' }">/{{ player.maxHp }}</span>
                </div>

              </div>

              <!-- Effetti di stato: SOTTO all'HUD (che ora è in alto) -->
              <div v-if="fieldEffects.player.length" :style="{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', marginTop:'6px' }">
                <span v-for="e in fieldEffects.player" :key="e.status" :style="effectChipStyle(e)">
                  <span style="font-size:12px;line-height:1;">{{ effectIcon(e) }}</span>
                  <span>{{ e.label }}<template v-if="(e.dannoPerTurno ?? 0) > 0"> −{{ e.dannoPerTurno }}/t</template> · {{ e.turni }}t</span>
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ── ZONA 5+6: Action Panel ── -->
      <!-- Altezza FISSA (non min/max variabile): così l'arena sopra non si ridimensiona
           tra le fasi e le carte non si alzano/abbassano. Ma COMPATTA: con 50dvh i
           bottoni mossa (flex:1) si stiravano diventando giganti. Il contenuto più
           alto (fase cambio) scrolla internamente (overflowY:auto). -->
      <div :style="{
        flexShrink:0,
        height: isMobile ? 'clamp(176px, 25dvh, 216px)' : 'clamp(188px, 27dvh, 230px)',
        display:'flex', flexDirection:'column',
        background:'var(--theme-surface)',
        borderTop:'1px solid var(--theme-border)',
        overflow:'hidden',
      }">

        <!-- Timer progress bar — traccia SEMPRE renderizzata: se sparisse col
             v-if tutto il pannello sotto salirebbe/scenderebbe di 3px -->
        <div :style="{ height:'3px',background:'var(--theme-border)',flexShrink:0 }">
          <div :style="{
            height:'100%', background:timerCol,
            width: isChoose ? `${(timer/30)*100}%` : '0%',
            transition:'width 1s linear,background .5s',
          }"/>
        </div>

        <!-- ── Menù azioni → griglia mosse (il cambio waifu è un popup a parte) ── -->
        <template v-if="!(isSwap || isVolSwap || (allPPOut && isChoose))">
          <!-- Segmented control MOSSE | WAIFU | ABBANDONA — pill con bordo viola,
               riempie TUTTO lo spazio; ABBANDONA è il segmento "selezionato"
               (gradiente fisso, come il segmented della Classifica) -->
          <!-- NB: sono <div>, NON <button>: la regola globale button{border-radius:pill!important}
               forzerebbe il radius sui singoli. Il SOLO elemento arrotondato è il
               contenitore .wba-seg (overflow:hidden). ABBANDONA = segmento attivo viola. -->
          <div v-if="actionMenu === 'menu'" :style="{ flex:1, display:'flex', padding:'10px 12px', minHeight:0 }">
            <div :style="{
              flex:1, display:'flex', alignItems:'stretch',
              border:'1.5px solid var(--theme-accent)',
              borderRadius:'16px', overflow:'hidden',
              background:'var(--theme-surface-2)',
              boxShadow:'0 2px 12px var(--theme-shadow)',
            }">
              <div
                role="button"
                @click="() => { if (!(!isChoose || isAnim || (isPvP && pvpWaiting))) actionMenu = 'moves' }"
                :style="{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor: (!isChoose || isAnim || (isPvP && pvpWaiting)) ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--ff-label)', fontSize:'14px', fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase',
                  color:'var(--theme-accent)', opacity: (!isChoose || isAnim || (isPvP && pvpWaiting)) ? .4 : 1,
                  userSelect:'none',
                }"
              >MOSSE</div>
              <div :style="{ width:'1.5px', background:'var(--theme-accent)', opacity:.45, flexShrink:0 }" />
              <div
                role="button"
                @click="() => { if (!swapDisabled) startVoluntarySwap() }"
                :style="{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor: swapDisabled ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--ff-label)', fontSize:'14px', fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase',
                  color:'var(--theme-accent)', opacity: swapDisabled ? .4 : 1,
                  userSelect:'none',
                }"
              >WAIFU</div>
              <div
                role="button"
                @click="confirmQuit = true"
                :style="{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', userSelect:'none',
                  background:'linear-gradient(to left, var(--theme-accent) 0%, var(--theme-accent) 55%, transparent 100%)',
                  fontFamily:'var(--ff-label)', fontSize:'14px', fontWeight:900, letterSpacing:'.14em', textTransform:'uppercase',
                  color:'#fff',
                }"
              >ABBANDONA</div>
            </div>
          </div>

          <template v-else>
          <!-- Torna al menù azioni -->
          <div :style="{ flexShrink:0, padding:'8px 14px 12px' }">
            <button @click="actionMenu = 'menu'" :style="{
              background:'none', border:'none', cursor:'pointer', padding:'4px 6px',
              fontFamily:'var(--ff-label)', fontSize:'12px', fontWeight:800, letterSpacing:'.1em',
              color:'var(--theme-text-3)',
            }">← MENU</button>
          </div>

          <!-- Griglia mosse 2×2 -->
          <div :style="{ flex:1,position:'relative',padding:'0 12px 12px',display:'flex',flexDirection:'column',minHeight:0 }">
            <!-- PvP waiting overlay -->
            <div v-if="isPvP && pvpWaiting" :style="{
              position:'absolute',inset:'2px 10px 6px',zIndex:5,
              background:'rgba(0,0,0,.58)',borderRadius:'12px',
              backdropFilter:'blur(3px)',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'7px',
              pointerEvents:'none',
            }">
              <div :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',color:'rgba(0,200,255,.75)',letterSpacing:'1.5px' }">MOSSA INVIATA ✓</div>
              <div :style="{ fontFamily:'var(--ff-body)',fontSize:'12px',color:'var(--theme-text-3)' }">Attendo la mossa avversaria…</div>
            </div>

            <div :style="{
              flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:'8px',
              minHeight: 0,
            }">
              <template v-for="(move, i) in (player?.moves ?? [null,null,null,null])" :key="i">
                <!-- MoveBtn inline -->
                <button
                  class="wba-move-btn"
                  :disabled="!isChoose || isAnim || (isPvP && pvpWaiting) || (move?.pp ?? 0) <= 0 || isMoveBlocked(lastPMove, i, move ?? ({} as MoveInstance))"
                  @pointerdown="moveLongPressStart(move)"
                  @pointerup="moveLongPressEnd"
                  @pointerleave="moveLongPressEnd"
                  @pointercancel="moveLongPressEnd"
                  @contextmenu.prevent
                  @click="() => { if (consumeLongPress()) return; if (move && (move.pp ?? 0) > 0 && !isMoveBlocked(lastPMove, i, move)) { handleMove(i); actionMenu = 'menu' } }"
                  :style="(() => {
                    if (!move) return {
                      height:'100%',borderRadius:'12px',
                      background:'rgba(10,5,20,.3)',border:'1px solid rgba(255,255,255,.04)',
                      cursor:'not-allowed',
                    }
                    const dis     = !isChoose || isAnim || (isPvP && pvpWaiting) || (move.pp ?? 0) <= 0 || isMoveBlocked(lastPMove, i, move)
                    const isOutPp = (move.pp ?? 0) <= 0
                    const cd      = isMoveBlocked(lastPMove, i, move)
                    const c       = _TYPE_COLORS_UI[move.type] ?? { bg:'#111', text:'#eee', border:'#555' }
                    return {
                      height:'100%', padding:'7px 11px', borderRadius:'14px', width:'100%',
                      background: isOutPp ? _DISABLED_MOVE_STYLE.bg : cd ? `${c.bg ?? 'rgba(255,255,255,0.12)'}99` : c.bg ?? 'rgba(255,255,255,0.12)',
                      border: isOutPp ? _DISABLED_MOVE_STYLE.border : cd ? `0.8px solid ${c.border}66` : `0.8px solid ${c.border}`,
                      backdropFilter: isOutPp ? 'none' : 'blur(8px)',
                      WebkitBackdropFilter: isOutPp ? 'none' : 'blur(8px)',
                      boxShadow: isOutPp || cd ? 'none' : `0 2px 12px rgba(0,0,0,.35),0 0 6px ${c.border}22`,
                      color: isOutPp ? _DISABLED_MOVE_STYLE.color : cd ? `${c.border}99` : c.text ?? '#f1ebff',
                      opacity: cd ? 0.65 : 1,
                      fontFamily: '\'DM Sans\', sans-serif',
                      cursor: dis ? 'not-allowed' : 'pointer',
                      display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-start',
                      position:'relative', overflow:'visible',
                    }
                  })()"
                >
                  <!-- Chip tipo — full-round, in alto a destra (sbordo ridotto per #14) -->
                  <span v-if="move && (move.pp ?? 0) > 0 && !isMoveBlocked(lastPMove, i, move)" :style="{
                    position:'absolute', top:'-8px', right:'-6px', zIndex:3,
                    background:`rgba(${hexToRgb((_TYPE_COLORS_UI[move.type] ?? { border:'#555' }).border)},.18)`,
                    color:(_TYPE_COLORS_UI[move.type] ?? { border:'#555' }).border,
                    border:`1.5px solid ${(_TYPE_COLORS_UI[move.type] ?? { border:'#555' }).border}`,
                    borderRadius:'9999px', padding:'2px 10px',
                    fontSize:'12px', fontWeight:800,
                    fontFamily:'var(--ff-label)', letterSpacing:.5,
                    whiteSpace:'nowrap', backdropFilter:'blur(4px)',
                    boxShadow:'0 2px 8px rgba(0,0,0,0.25)',
                  }">{{ move.type }}</span>
                  <template v-if="move">
                    <div :style="{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',width:'100%',gap:'4px' }">
                      <span :style="{
                        fontFamily:'var(--ff-label)',fontSize:'14px',fontWeight:700,lineHeight:1.3,
                        color: (move.pp ?? 0) <= 0
                          ? _DISABLED_MOVE_STYLE.color
                          : isMoveBlocked(lastPMove, i, move) ? `${(_TYPE_COLORS_UI[move.type]?.border ?? '#555')}99`
                          : (_TYPE_COLORS_UI[move.type]?.border ?? '#555'),
                        flex:1, wordBreak:'break-word',
                        textDecoration: (move.pp ?? 0) <= 0 ? 'line-through' : 'none',
                      }">{{ move.name }}</span>
                      <Lock v-if="isMoveBlocked(lastPMove, i, move)" :size="11" stroke-width="1.5" style="flex-shrink:0;color:var(--theme-text-2);" />
                    </div>
                    <!-- Riga inferiore: PP a sinistra · chip EFFICACIA/stato a destra -->
                    <div :style="{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',width:'100%',gap:'6px',marginTop:'auto' }">
                      <div :style="{ display:'flex',gap:'3px',alignItems:'center' }">
                        <template v-for="(_, di) in Array.from({ length: Math.min(move.maxPp ?? 8, 8) })" :key="di">
                          <div :style="{
                            width:'5px',height:'5px',borderRadius:'50%',flexShrink:0,
                            background: (move.pp ?? 0) <= 0 ? _DISABLED_MOVE_STYLE.color : (_TYPE_COLORS_UI[move.type]?.border ?? '#555'),
                            opacity: di < Math.max(0, Math.min(Math.min(move.maxPp ?? 8, 8), Math.round((move.pp ?? 0) * Math.min(move.maxPp ?? 8, 8) / (move.maxPp ?? 8)))) ? 1 : 0.22,
                          }"/>
                        </template>
                        <span :style="{
                          fontFamily:'var(--ff-label)', fontSize:'11px',
                          color: (move.pp ?? 0) <= 0 ? _DISABLED_MOVE_STYLE.color : (_TYPE_COLORS_UI[move.type]?.border ?? '#555'),
                          marginLeft:'3px',opacity:0.85,flexShrink:0,
                        }">{{ move.pp ?? 0 }}/{{ move.maxPp ?? 8 }}</span>
                      </div>
                      <!-- Chip efficacia / cooldown / PP0 in basso a destra -->
                      <span v-if="isMoveBlocked(lastPMove, i, move)" :style="{
                        flexShrink:0, borderRadius:'9999px', padding:'2px 8px', fontSize:'10px', fontWeight:700,
                        fontFamily:'var(--ff-label)', whiteSpace:'nowrap',
                        background:`${(_TYPE_COLORS_UI[move.type]?.border ?? '#555')}22`,
                        color:`${(_TYPE_COLORS_UI[move.type]?.border ?? '#555')}cc`,
                        border:`1px solid ${(_TYPE_COLORS_UI[move.type]?.border ?? '#555')}55`,
                      }"><Lock :size="8" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:2px;" />1 turno</span>
                      <span v-else-if="(move.pp ?? 0) <= 0" :style="{
                        flexShrink:0, borderRadius:'9999px', padding:'2px 8px', fontSize:'10px', fontWeight:700,
                        fontFamily:'var(--ff-label)', whiteSpace:'nowrap',
                        background:`${_DISABLED_MOVE_STYLE.color}22`, color:_DISABLED_MOVE_STYLE.color,
                        border:`1px solid ${_DISABLED_MOVE_STYLE.color}44`,
                      }">PP 0</span>
                      <span v-else :style="{
                        flexShrink:0, borderRadius:'9999px', padding:'2px 8px', fontSize:'10px',
                        fontWeight: getEffDisplay(move.type, enemy?.type ?? 'Arcana', player?.type ?? 'Arcana').bold ? 800 : 600,
                        fontFamily:'var(--ff-label)', whiteSpace:'nowrap',
                        background:`${getEffDisplay(move.type, enemy?.type ?? 'Arcana', player?.type ?? 'Arcana').col}22`,
                        color: getEffDisplay(move.type, enemy?.type ?? 'Arcana', player?.type ?? 'Arcana').col,
                        border:`1px solid ${getEffDisplay(move.type, enemy?.type ?? 'Arcana', player?.type ?? 'Arcana').col}55`,
                      }">{{ getEffDisplay(move.type, enemy?.type ?? 'Arcana', player?.type ?? 'Arcana').lbl }}</span>
                    </div>
                  </template>
                </button>
              </template>
            </div>
          </div>
          </template>
        </template>
      </div>
    </div>

    <!-- ── POPUP CAMBIO WAIFU — a tutto schermo e scrollabile ── -->
    <div v-if="isSwap || isVolSwap || (allPPOut && isChoose)" :style="{
      position:'fixed', inset:0, zIndex:500,
      background:'var(--theme-bg)',
      display:'flex', flexDirection:'column',
      paddingTop:'max(14px, env(safe-area-inset-top))',
    }">
      <div :style="{ flexShrink:0, position:'relative', padding:'16px 56px 12px', textAlign:'center' }">
        <div :style="{
          fontFamily:'var(--ff-label)', fontSize:'13px', letterSpacing:'1.8px', fontWeight:800,
          color: isVolSwap ? '#f5a623' : '#ff4d4d',
        }">
          {{ isVolSwap ? '↻ SCEGLI LA WAIFU DA MANDARE IN CAMPO' : isSwap ? '⚠ SCEGLI LA PROSSIMA WAIFU' : '⚠ PP ESAURITI — SOSTITUISCI LA WAIFU' }}
        </div>
        <button v-if="isVolSwap" @click="cancelVoluntarySwap" :style="{
          position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)',
          width:'36px', height:'36px', display:'grid', placeItems:'center',
          background:'none', border:'1px solid var(--theme-border-2)', borderRadius:'10px',
          color:'var(--theme-text-2)', fontSize:'15px', cursor:'pointer', lineHeight:1,
        }">✕</button>
      </div>
      <div :style="{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', touchAction:'pan-y', padding:'14px 16px calc(28px + env(safe-area-inset-bottom))' }">
        <div :style="{
          display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(92px, 1fr))',
          gap:'16px 10px', maxWidth:'560px', margin:'0 auto',
        }">
          <template v-for="(w, i) in pTeam" :key="w.id">
            <div v-if="i !== pActive && !w.isKO" :style="{ display:'flex', flexDirection:'column', gap:'8px', position:'relative' }">
              <!-- Chip TIPO — rettangolare 8px, alto-destra dello slot -->
              <div v-if="w.type" :style="{
                position:'absolute', top:'-7px', right:'-7px', zIndex:6,
                background:'var(--theme-surface)',
                border:`1.5px solid ${(TYPE_COLORS[w.type]?.border ?? '#555')}`,
                color:(TYPE_COLORS[w.type]?.border ?? '#999'),
                borderRadius:'7px', padding:'2px 6px',
                fontFamily:'var(--ff-label)', fontSize:'9px', fontWeight:800,
                letterSpacing:'.04em', textTransform:'uppercase',
                boxShadow:'0 2px 8px rgba(0,0,0,0.4)', pointerEvents:'none',
              }">{{ w.type }}</div>
              <!-- Slot RETTANGOLARE (radius 8px) a tutta larghezza colonna -->
              <button class="wba-bench-slot"
                @pointerdown="swapPressStart(w)"
                @pointerup="swapPressEnd"
                @pointerleave="swapPressEnd"
                @pointercancel="swapPressEnd"
                @contextmenu.prevent
                @click="() => { if (consumeSwapLongPress()) return; isSwap ? handlePlayerSwap(i) : handleVoluntarySwap(i, { isPPExhausted: !isSwap && !isVolSwap }) }"
                :style="{
                  width:'100%', aspectRatio:'3/4', borderRadius:'10px', overflow:'hidden',
                  border:'2px solid #00e676',
                  boxShadow:'0 0 10px rgba(0,230,118,.28),0 0 0 1px rgba(0,230,118,.15)',
                  background:'var(--theme-bg-secondary)', position:'relative',
                  cursor:'pointer', padding:0,
                  animation:'benchPop .22s ease-out',
                }"
              >
                <img v-if="w.image" :src="ikUrl(w.image, 'card') ?? ''" :alt="w.name"
                  :style="{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top' }"/>
                <div v-else :style="{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'13px',opacity:.22 }">◈</div>
                <div :style="{ position:'absolute',bottom:0,left:0,right:0,height:'4px',background:'var(--theme-border)' }">
                  <div :style="{
                    width:`${w.maxHp > 0 ? Math.max(0, Math.min(100, (w.hp / w.maxHp) * 100)) : 0}%`,
                    height:'100%',
                    background: (w.maxHp > 0 ? (w.hp / w.maxHp) * 100 : 0) > 50 ? '#00e676' : (w.maxHp > 0 ? (w.hp / w.maxHp) * 100 : 0) > 25 ? '#ffd666' : '#ff4d4d',
                  }"/>
                </div>
              </button>
              <div :style="{ textAlign:'center' }">
                <div :style="{ fontFamily:'var(--ff-label)',fontSize:'12px',fontWeight:700,color:'var(--theme-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }">
                  {{ w.name }}
                </div>
                <div :style="{ fontFamily:'var(--ff-label)',fontSize:'10px',color:'var(--theme-text-3)' }">
                  {{ Math.max(0, w.hp) }}/{{ w.maxHp }} HP
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ── DETTAGLIO WAIFU (long-press nel cambio): tipo + mosse ── -->
    <div v-if="swapDetail" @click="swapDetail = null"
      style="position:fixed;inset:0;z-index:620;background:rgba(4,2,14,0.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:22px;">
      <div @click.stop :style="{
        width:'100%', maxWidth:'340px', maxHeight:'86dvh', overflowY:'auto',
        background:'var(--theme-surface)', border:'1px solid var(--theme-border)',
        borderRadius:'18px', padding:'16px', boxShadow:'0 12px 40px var(--theme-shadow)',
      }">
        <div :style="{ display:'flex', gap:'12px', alignItems:'flex-start', marginBottom:'12px' }">
          <div :style="{ width:'96px', aspectRatio:'3/4', borderRadius:'8px', overflow:'hidden', flexShrink:0, border:`2px solid ${(TYPE_COLORS[swapDetail.type]?.border ?? '#555')}` }">
            <img v-if="swapDetail.image" :src="ikUrl(swapDetail.image, 'thumbnail') ?? ''" :alt="swapDetail.name"
              :style="{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }"/>
          </div>
          <div :style="{ flex:1, minWidth:0 }">
            <div :style="{ fontFamily:'var(--ff-display)', fontSize:'16px', fontWeight:900, color:'var(--theme-text)', marginBottom:'6px' }">{{ swapDetail.name }}</div>
            <span :style="{
              display:'inline-block', background:'var(--theme-surface-2)',
              border:`1.5px solid ${(TYPE_COLORS[swapDetail.type]?.border ?? '#555')}`,
              color:(TYPE_COLORS[swapDetail.type]?.border ?? '#999'),
              borderRadius:'8px', padding:'3px 10px', marginBottom:'8px',
              fontFamily:'var(--ff-label)', fontSize:'11px', fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase',
            }">{{ swapDetail.type }}</span>
            <div :style="{ fontFamily:'var(--ff-label)', fontSize:'13px', color:'var(--theme-text-2)' }">
              HP {{ Math.max(0, swapDetail.hp) }}/{{ swapDetail.maxHp }} · VEL {{ swapDetail.speed }} · CRIT {{ Math.round((swapDetail.critChance ?? 0) * 100) }}%
            </div>
          </div>
        </div>
        <!-- Mosse con tipologia -->
        <div :style="{ display:'flex', flexDirection:'column', gap:'7px' }">
          <div v-for="(mv, mi) in swapDetail.moves" :key="mi" :style="{
            display:'flex', alignItems:'center', gap:'8px',
            padding:'8px 10px', borderRadius:'10px',
            background:'var(--theme-surface-2)', border:'1px solid var(--theme-border)',
          }">
            <span :style="{
              flexShrink:0, background:'var(--theme-surface)',
              border:`1.5px solid ${(TYPE_COLORS[mv.type]?.border ?? '#555')}`,
              color:(TYPE_COLORS[mv.type]?.border ?? '#999'),
              borderRadius:'8px', padding:'2px 8px',
              fontFamily:'var(--ff-label)', fontSize:'10px', fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase',
            }">{{ mv.type }}</span>
            <span :style="{ flex:1, fontFamily:'var(--ff-label)', fontSize:'13px', fontWeight:700, color:'var(--theme-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">{{ mv.name }}</span>
            <span :style="{ fontFamily:'var(--ff-mono)', fontSize:'12px', color:'var(--theme-text-2)', flexShrink:0 }">{{ mv.power }} · PP {{ mv.pp }}/{{ mv.maxPp }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── POPUP CONFERMA ABBANDONO ── -->
    <div v-if="confirmQuit"
      style="position:fixed;inset:0;z-index:640;background:rgba(4,2,14,0.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;"
      @click.self="confirmQuit = false">
      <div :style="{
        width:'100%', maxWidth:'320px',
        background:'var(--theme-surface)', border:'1px solid var(--theme-border)',
        borderRadius:'18px', padding:'24px 22px', textAlign:'center',
        boxShadow:'0 12px 40px var(--theme-shadow)',
      }">
        <div :style="{ fontFamily:'var(--ff-display)', fontSize:'15px', fontWeight:800, color:'#ff4d4d', letterSpacing:'.06em', marginBottom:'8px' }">
          ABBANDONARE LA PARTITA?
        </div>
        <div :style="{ fontFamily:'var(--ff-body)', fontSize:'13px', lineHeight:1.5, color:'var(--theme-text-2)', marginBottom:'18px' }">
          La battaglia si concluderà subito con la tua sconfitta.
        </div>
        <div :style="{ display:'flex', gap:'10px' }">
          <button @click="confirmQuit = false" :style="{
            flex:1, padding:'12px 0', background:'none',
            border:'1px solid var(--theme-border)', borderRadius:'12px',
            color:'var(--theme-text-3)', fontFamily:'var(--ff-label)', fontSize:'12px', fontWeight:800,
            letterSpacing:'.08em', cursor:'pointer',
          }">ANNULLA</button>
          <button @click="quitBattle" :style="{
            flex:1.3, padding:'12px 0', background:'#ff4d4d',
            border:'none', borderRadius:'12px',
            color:'#fff', fontFamily:'var(--ff-label)', fontSize:'12px', fontWeight:800,
            letterSpacing:'.08em', cursor:'pointer',
            boxShadow:'0 6px 18px rgba(255,77,77,0.4)',
          }">SÌ, ABBANDONA</button>
        </div>
      </div>
    </div>

    <!-- Overlay LANCIO MONETA (effetti bloccanti) -->
    <div v-if="coinFlip"
      style="position:fixed;inset:0;z-index:650;background:rgba(4,2,14,0.78);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div :style="{ fontFamily:'var(--ff-label)', fontSize:'14px', letterSpacing:'0.22em', color:'var(--theme-text-2)', textTransform:'uppercase', fontWeight:700 }">
          {{ coinFlip.who }} · lancio della moneta
        </div>
        <!-- #12: mostra chiaramente PER QUALE effetto avviene il lancio -->
        <div v-if="coinFlip.effect" :style="{ fontFamily:'var(--ff-label)', fontSize:'13px', fontWeight:800, letterSpacing:'0.06em', color:'#b46bff', background:'rgba(180,107,255,0.14)', border:'1px solid rgba(180,107,255,0.5)', borderRadius:'999px', padding:'4px 14px', textTransform:'uppercase' }">
          {{ coinFlip.effect }}
        </div>
        <div :style="{ fontFamily:'var(--ff-body)', fontSize:'11px', color:'var(--theme-text-3)', textAlign:'center', maxWidth:'240px', lineHeight:1.4 }">
          Testa → si libera e attacca · Croce → salta il turno
        </div>
      </div>
      <!-- Moneta 3D: testa = retro carta, croce = stessa immagine in scala di grigi -->
      <div class="wba-coin-scene">
        <div class="wba-coin" :class="coinFlip.done ? (coinFlip.result === 'testa' ? 'wba-coin--heads' : 'wba-coin--tails') : 'wba-coin--spin'">
          <div class="wba-coin__face wba-coin__face--front">
            <img :src="backCardImg" alt="testa" />
          </div>
          <div class="wba-coin__face wba-coin__face--back">
            <img :src="backCardImg" alt="croce" style="filter:grayscale(1) brightness(0.85);" />
          </div>
        </div>
      </div>
      <div v-if="coinFlip.done" :style="{
        fontFamily:'var(--ff-display)', fontSize:'22px', fontWeight:900, letterSpacing:'0.1em',
        color: coinFlip.result === 'testa' ? '#58e0a3' : '#ff5b6c',
        textShadow: `0 0 24px ${coinFlip.result === 'testa' ? '#58e0a377' : '#ff5b6c77'}`,
        animation:'fadeMsg 0.25s ease-out',
      }">{{ coinFlip.result === 'testa' ? 'TESTA!' : 'CROCE…' }}</div>
    </div>

    <!-- #27: Popup dettaglio waifu attiva (tap sul ritratto in battaglia) -->
    <div v-if="waifuDetail" @click="waifuDetail = null"
      style="position:fixed;inset:0;z-index:610;background:rgba(4,2,14,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;">
      <div @click.stop style="width:100%;max-width:320px;background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:20px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.6);animation:scaleIn 0.22s ease-out;">
        <div style="position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;">
          <img v-if="waifuDetail.w.image" :src="ikUrl(waifuDetail.w.image, 'normal') ?? ''" :alt="waifuDetail.w.name" style="width:100%;height:100%;object-fit:cover;object-position:center 22%;" />
          <div style="position:absolute;top:8px;left:8px;display:flex;gap:6px;">
            <span :style="{ background:'#fff', color:'#1a1a2e', borderRadius:'999px', padding:'2px 10px', fontFamily:'var(--ff-label)', fontSize:'10px', fontWeight:800, textTransform:'capitalize', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }">{{ waifuDetail.w.rarita }}</span>
            <span :style="{ background:(TYPE_COLORS[waifuDetail.w.type]?.border ?? '#555'), color:'#fff', borderRadius:'999px', padding:'2px 10px', fontFamily:'var(--ff-label)', fontSize:'10px', fontWeight:800 }">{{ waifuDetail.w.type }}</span>
          </div>
        </div>
        <div style="padding:14px 16px 16px;">
          <div style="font-family:var(--ff-display);font-size:18px;font-weight:800;color:var(--theme-text);margin-bottom:10px;">{{ waifuDetail.w.name }}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div :style="{ background:'var(--theme-surface-2)', borderRadius:'10px', padding:'8px 10px' }">
              <div style="font-family:var(--ff-label);font-size:10px;color:var(--theme-text-3);letter-spacing:0.1em;text-transform:uppercase;">HP</div>
              <div style="font-family:var(--ff-label);font-size:15px;font-weight:800;color:var(--theme-text);">{{ Math.max(0, waifuDetail.w.hp) }}/{{ waifuDetail.w.maxHp }}</div>
            </div>
            <div :style="{ background:'var(--theme-surface-2)', borderRadius:'10px', padding:'8px 10px' }">
              <div style="font-family:var(--ff-label);font-size:10px;color:var(--theme-text-3);letter-spacing:0.1em;text-transform:uppercase;">Velocità</div>
              <div style="font-family:var(--ff-label);font-size:15px;font-weight:800;color:var(--theme-text);">{{ waifuDetail.w.speed }}</div>
            </div>
            <div :style="{ background:'var(--theme-surface-2)', borderRadius:'10px', padding:'8px 10px' }">
              <div style="font-family:var(--ff-label);font-size:10px;color:var(--theme-text-3);letter-spacing:0.1em;text-transform:uppercase;">Critico</div>
              <div style="font-family:var(--ff-label);font-size:15px;font-weight:800;color:var(--theme-text);">{{ waifuDetail.w.critChance }}%</div>
            </div>
            <div :style="{ background:'var(--theme-surface-2)', borderRadius:'10px', padding:'8px 10px' }">
              <div style="font-family:var(--ff-label);font-size:10px;color:var(--theme-text-3);letter-spacing:0.1em;text-transform:uppercase;">Tipo</div>
              <div style="font-family:var(--ff-label);font-size:15px;font-weight:800;color:var(--theme-text);">{{ waifuDetail.w.type }}</div>
            </div>
          </div>
          <!-- Effetti attivi -->
          <div v-if="fieldEffects[waifuDetail.side].length" style="display:flex;flex-wrap:wrap;gap:6px;">
            <span v-for="(e, ei) in fieldEffects[waifuDetail.side]" :key="ei" :style="effectChipStyle(e)">
              <span style="font-size:12px;line-height:1;">{{ effectIcon(e) }}</span>
              <span>{{ e.label }}<template v-if="(e.dannoPerTurno ?? 0) > 0"> −{{ e.dannoPerTurno }}/t</template></span>
            </span>
          </div>
          <div v-else style="font-family:var(--ff-body);font-size:12px;color:var(--theme-text-3);">Nessun effetto attivo</div>
        </div>
      </div>
    </div>

    <!-- Popup dettaglio mossa (long-press): carta completa con la spiegazione -->
    <div v-if="moveDetail" @click="moveDetail = null"
      style="position:fixed;inset:0;z-index:600;background:rgba(4,2,14,0.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;">
      <div @click.stop style="width:280px;animation:fadeIn 0.2s ease-out;">
        <MoveCard :move="(moveDetail as any)" :owned="true" :large="true" />
      </div>
    </div>
  </template>
</template>
