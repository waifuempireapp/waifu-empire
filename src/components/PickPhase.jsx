/**
 * @module PickPhase
 * @description Schermata di draft segreta "3-from-roster" che precede il caricamento
 * di WaifuBattleArena. Ogni giocatore sceglie 3 waifu dal proprio roster (da 5)
 * senza vedere le scelte dell'avversario.
 *
 * Modalità supportate:
 *   - CPU        : il giocatore sceglie 3 waifu; la CPU pesca casualmente al mount.
 *   - PvP Online : ogni giocatore sceglie sul proprio dispositivo;
 *                  la sync avviene via Firestore (gestita dal parent MappaMultiplayer).
 *
 * NON esiste più la modalità "pass-the-device" (stesso dispositivo).
 * Il PvP è sempre online e sincronizzato.
 *
 * Principio SOLID applicato — SRP (Single Responsibility Principle):
 *   - `MiniHpBar`    : responsabile SOLO del rendering della barra HP.
 *   - `WaifuPickCard`: responsabile SOLO del rendering di una singola card waifu.
 *   - `TypeBadge`    : responsabile SOLO del badge del tipo elemento.
 *   - `S`            : costante che centralizza SOLO gli stili condivisi (DRY).
 *   - `PickPhase`    : gestisce SOLO la logica di pick e il routing degli step.
 *   - `RevealScreen` : componente standalone responsabile SOLO della schermata di reveal.
 *
 * Named exports: RevealScreen (usata quando entrambi i pick sono noti).
 * La segretezza è client-side (accettabile per gioco casual/social).
 */
'use client';
// [WAIFU CHAMPIONS REFACTOR] — combat-system-v2
// PickPhase: hidden 3-from-roster draft before WaifuBattleArena loads.
// Supports CPU mode and Online PvP mode (each player picks on their own device).
// Pass-the-device PvP removed — all PvP is online/synchronized via Firestore.
// Named exports: RevealScreen (standalone reveal used when both picks are known)
import { useState, useEffect, useRef } from 'react';
import { TYPE_COLORS, initBattleWaifu, computeSpeed, computeCritChance } from '@/lib/battleEngine';

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI DI LOGICA
// Principio SRP: i magic numbers sono definiti UNA sola volta qui, con
// documentazione esplicita del loro significato.
// DRY: sostituiscono valori hardcoded sparsi nel file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Numero di waifu che il giocatore deve selezionare per confermare il team.
 * Il primo slot entra subito in campo, gli altri sono la riserva.
 *
 * @type {number}
 */
const PICKS_RICHIESTI = 3;

/**
 * Numero minimo di waifu nel roster per accedere alla pick phase.
 * La pick phase richiede un pool più ampio del team finale (5 > 3)
 * per garantire varietà strategica nella scelta.
 *
 * @type {number}
 */
const ROSTER_MIN = 5;

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: TypeBadge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Badge colorato che mostra il tipo elemento di una waifu.
 * I colori sono derivati da `TYPE_COLORS` definito in battleEngine.
 *
 * Principio SRP: responsabile esclusivamente del rendering del badge tipo.
 *
 * @param {Object} props
 * @param {string} props.type - Stringa del tipo elemento (es. 'Arcana', 'Fuoco', ecc.).
 * @returns {JSX.Element}
 */
function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] ?? { border: '#555', bg: '#111' };
  return (
    <span style={{
      background: `${c.bg}cc`, color: c.border,
      border: `1px solid ${c.border}88`,
      borderRadius: 4, padding: '1px 6px', fontSize: 8,
      fontWeight: 700, fontFamily: 'Orbitron,monospace',
      letterSpacing: 0.5, display: 'inline-block', whiteSpace: 'nowrap',
    }}>{type}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI RARITÀ
// Mappa rarità → colore del badge e gradiente di sfondo della card.
// Principio OCP: aggiungere una nuova rarità richiede solo una riga qui.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Colori e sfondi per ciascuna rarità waifu.
 * - `badge`  : colore del testo/bordo del pill rarità
 * - `glow`   : colore del glow intorno al pill (versione semi-trasparente)
 * - `cardBg` : gradiente di sfondo della card per i livelli più alti
 */
const RARITY_STYLE = {
  immersivo:   { badge: '#ff7eb6', glow: 'rgba(255,126,182,0.35)', cardBg: 'linear-gradient(160deg, rgba(127,24,112,0.28), rgba(6,3,15,.75))' },
  leggendario: { badge: '#ffc861', glow: 'rgba(255,200,97,0.35)',  cardBg: 'linear-gradient(160deg, rgba(74,49,5,0.28),   rgba(6,3,15,.75))' },
  epico:       { badge: '#b573ff', glow: 'rgba(181,115,255,0.35)', cardBg: 'linear-gradient(160deg, rgba(42,18,85,0.28),  rgba(6,3,15,.75))' },
  raro:        { badge: '#5aa9ff', glow: 'rgba(90,169,255,0.35)',  cardBg: 'linear-gradient(160deg, rgba(20,42,85,0.28),  rgba(6,3,15,.75))' },
  comune:      { badge: '#b4bcc8', glow: 'rgba(180,188,200,0.2)',  cardBg: 'rgba(6,3,15,.6)' },
};

/**
 * Restituisce le costanti di stile per una rarità, con fallback su 'comune'.
 *
 * @param {string|undefined} rarita - Valore rarità della waifu (es. 'Epico').
 * @returns {{ badge: string, glow: string, cardBg: string }}
 */
function getRarityStyle(rarita) {
  return RARITY_STYLE[(rarita ?? '').toLowerCase()] ?? RARITY_STYLE.comune;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: MiniHpBar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Barra HP miniaturizzata per le card del roster.
 * Cambia colore in base alla percentuale di HP rimanenti:
 *   - > 50% → verde (#00e676)
 *   - 25–50% → giallo (#ffd666)
 *   - < 25% → rosso (#ff4d4d)
 *
 * Principio SRP: responsabile esclusivamente del rendering della barra HP.
 *
 * @param {Object} props
 * @param {number} props.hp    - HP correnti della waifu.
 * @param {number} props.maxHp - HP massimi della waifu (usati per calcolare la percentuale).
 * @returns {JSX.Element}
 */
function MiniHpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const col = pct > 50 ? '#00e676' : pct > 25 ? '#ffd666' : '#ff4d4d';
  return (
    <div style={{ height: 4, background: 'rgba(0,0,0,.4)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 4 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: WaifuPickCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Card interattiva per una singola waifu nella pick phase.
 * Mostra thumbnail, nome, tipo e (se `hideStats` è false) statistiche di battaglia.
 * Se selezionata, mostra un badge numerico col numero dello slot.
 *
 * Principio SRP: responsabile esclusivamente del rendering e dell'interazione
 * di una singola card waifu nel contesto del draft.
 *
 * @param {Object}   props
 * @param {Object}   props.waifu          - Documento Firestore della waifu.
 * @param {number|null} props.slot        - Numero di slot (1-based) se selezionata, null altrimenti.
 * @param {boolean}  props.selectable     - Se true, la card è cliccabile.
 * @param {Function} [props.onTap]        - Callback invocata al click se `selectable` è true.
 * @param {boolean}  [props.hideStats=false]
 *   Se true, mostra solo nome, immagine e tipo (usato per il roster avversario).
 * @returns {JSX.Element}
 */
function WaifuPickCard({ waifu, slot, selectable, onTap, hideStats = false }) {
  const bs = waifu._battleStats ?? waifu.battleStats ?? {};
  const maxHp = bs.maxHp ?? 300;
  const tc = TYPE_COLORS[bs.type ?? 'Arcana']?.border ?? '#444';
  const isSelected = slot !== null;

  // Rarità: prova i campi italiani e inglesi, fallback su 'comune'
  const rarita = waifu.rarità ?? waifu.rarita ?? waifu.rarity ?? 'Comune';
  const rs = getRarityStyle(rarita);

  // Immagine: prova più campi per compatibilità con diversi formati waifu
  // (waifu del catalogo, waifu CPU generate, waifu PvP da Firestore)
  const imgUrl = waifu.asset_statica ?? waifu.img ?? waifu.imgUrl ?? waifu.image ?? null;

  return (
    <button onClick={selectable ? onTap : undefined} style={{
      border: `2px solid ${isSelected ? '#00e676' : rs.badge + '55'}`,
      borderRadius: 12,
      // Le rarità alte (Epico+) hanno un leggero gradiente tematico anche da non selezionate
      background: isSelected ? 'rgba(0,230,118,.08)' : rs.cardBg,
      padding: '8px 10px',
      cursor: selectable ? 'pointer' : 'default',
      position: 'relative',
      textAlign: 'left',
      width: '100%',
      transition: 'border-color .15s, background .15s',
      WebkitTapHighlightColor: 'transparent',
      // Leggero glow laterale per rarità alte — aggiunge visibilità senza sovrastare
      boxShadow: ['epico','leggendario','immersivo'].includes(rarita.toLowerCase())
        ? `0 0 8px ${rs.glow}`
        : 'none',
    }}>
      {/* Badge slot — numero d'ordine di selezione */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg,#00e676,#00b050)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Orbitron', fontSize: 10, fontWeight: 900, color: '#000',
          border: '2px solid rgba(0,230,118,.6)',
        }}>{slot}</div>
      )}

      {/* Card layout: thumbnail a sinistra + info a destra */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>

        {/* Thumbnail — con overlay rarità in basso */}
        <div style={{
          width: 52, height: 78, borderRadius: 8, overflow: 'hidden',
          background: 'rgba(255,255,255,.04)', flexShrink: 0,
          border: `1.5px solid ${rs.badge}66`,
          position: 'relative',
        }}>
          {imgUrl
            ? <img
                src={imgUrl}
                alt={waifu.nome ?? waifu.name ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
              />
            : <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', fontSize: 20, color: rs.badge, opacity: 0.3,
              }}>◈</div>
          }
          {/* Pill rarità sovrapposto in basso sulla thumbnail — sempre visibile */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: `linear-gradient(transparent, rgba(0,0,0,0.8))`,
            padding: '8px 4px 3px',
            textAlign: 'center',
          }}>
            <span style={{
              fontFamily: 'Orbitron', fontSize: 6, fontWeight: 900,
              color: rs.badge, letterSpacing: 0.5,
              textShadow: `0 0 6px ${rs.glow}`,
            }}>{rarita.toUpperCase()}</span>
          </div>
        </div>

        {/* Info testo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nome waifu */}
          <div style={{
            fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700,
            color: '#eedcd4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {waifu.nome ?? waifu.name ?? '—'}
          </div>

          {/* Badge rarità testuale + badge tipo — sempre visibili per entrambi i roster */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'Orbitron', fontSize: 7, fontWeight: 800,
              color: rs.badge, background: `${rs.badge}18`,
              border: `1px solid ${rs.badge}55`,
              borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5,
              whiteSpace: 'nowrap',
            }}>{rarita}</span>
            <TypeBadge type={bs.type ?? 'Arcana'} />
          </div>

          {/* Statistiche — visibili solo per il roster del giocatore (hideStats=false) */}
          {!hideStats && (
            <>
              <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,.4)', marginTop: 4 }}>
                Lv {waifu.livello ?? 1} · HP {maxHp}
              </div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 7, color: 'rgba(238,232,220,.45)', marginTop: 2 }}>
                <span style={{ color: '#00C8FF' }}>Spd {computeSpeed(waifu)}</span>
                {'  '}
                <span style={{ color: '#f5a623' }}>Crit {Math.round(computeCritChance(waifu) * 100)}%</span>
              </div>
              <MiniHpBar hp={maxHp} maxHp={maxHp} />
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STILI CONDIVISI
// Principio SRP: gli stili sono separati dalla logica di rendering.
// DRY: centralizzati qui per evitare duplicazioni tra gli step della pick phase.
// Nota: `S` è definito FUORI dal componente perché non dipende da props o state —
// è una costante statica (uguale per tutti i render).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stili condivisi del componente PickPhase.
 * Centralizzati qui per evitare duplicazioni (DRY) e per facilitare
 * modifiche globali al layout senza toccare il render.
 *
 * Principio SRP: gli stili sono separati dalla logica di rendering.
 *
 * @type {Object}
 * @property {Object}   root       - Contenitore fullscreen fixed.
 * @property {Object}   header     - Header fisso in cima, non scrollabile.
 * @property {Object}   body       - Area centrale scrollabile.
 * @property {Object}   section    - Sezione interna con margine inferiore.
 * @property {Object}   label      - Label di sezione in stile Orbitron uppercase.
 * @property {Function} confirmBtn - Funzione `(active: boolean) => Object` che
 *   restituisce gli stili del pulsante di conferma (attivo o disabilitato).
 */
const S = {
  // `top` non è hardcoded qui: viene calcolato dinamicamente nel componente
  // misurando l'altezza reale di .hdr-root + .ntabs-root per non finire
  // sotto l'header sticky. bottom/left/right restano 0.
  // bottomOffset: altezza della bottom navbar (`.bottom-nav-mobile`), misurata dinamicamente.
  // In questo modo il panel termina esattamente sopra la navbar, invece di finirci dietro.
  root: (topOffset = 0, bottomOffset = 0) => ({
    position: 'fixed', top: topOffset, left: 0, right: 0, bottom: bottomOffset, zIndex: 40,
    background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', // il body interno scorre, non il root
  }),
  header: {
    flexShrink: 0,
    padding: '10px 14px 8px',
    borderBottom: '1px solid rgba(255,255,255,.07)',
    background: 'rgba(6,3,15,.55)',
  },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px', WebkitOverflowScrolling: 'touch' },
  section: { marginBottom: 16 },
  label: { fontFamily: 'Orbitron', fontSize: 8, letterSpacing: 2, color: 'rgba(238,232,220,.4)', marginBottom: 6 },
  confirmBtn: (active) => ({
    width: '100%', padding: '14px 0', marginTop: 10,
    background: active ? 'linear-gradient(135deg,#00e676,#00b050)' : 'rgba(255,255,255,.06)',
    border: active ? 'none' : '1px solid rgba(255,255,255,.1)',
    borderRadius: 12, cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.45,
    fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700,
    color: active ? '#000' : 'rgba(238,232,220,.4)', letterSpacing: 2,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPALE: PickPhase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schermata di pick phase: draft segreto prima di WaifuBattleArena.
 *
 * Il giocatore (e, in modalità PvP, anche l'avversario) seleziona {@link PICKS_RICHIESTI}
 * waifu dal proprio roster di {@link ROSTER_MIN}. La prima waifu selezionata entra
 * subito in campo; le altre costituiscono la riserva.
 *
 * Flusso:
 *   Ogni giocatore vede la schermata di picking sul proprio dispositivo.
 *   Dopo aver confermato 3 waifu, `onConfirm` viene chiamato immediatamente.
 *   NON esistono step 'handoff' o 'p2pick' — la modalità pass-the-device è rimossa.
 *
 * Principio SRP: il componente gestisce SOLO il routing tra gli step del draft
 * e la costruzione dei team da passare a `onConfirm`. Il rendering di ogni step
 * è isolato nel proprio blocco condizionale.
 *
 * @param {Object}   props
 * @param {Object[]} [props.roster5P=[]]
 *   Fino a {@link ROSTER_MIN} documenti Firestore delle waifu del giocatore.
 * @param {Object[]} [props.roster5E=[]]
 *   Fino a {@link ROSTER_MIN} documenti Firestore delle waifu dell'avversario/CPU.
 * @param {boolean}  [props.isCpu=true]
 *   True quando il giocatore combatte contro la CPU.
 *   La CPU pesca {@link PICKS_RICHIESTI} waifu casuali al mount.
 * @param {boolean}  [props.isOnlinePvP=false]
 *   True in modalità PvP online (dispositivi separati, sempre sincronizzato via Firestore).
 *   Il giocatore conferma il proprio team e `onConfirm` viene chiamato immediatamente;
 *   il team avversario arriva tramite Firestore (gestito dal parent).
 * @param {Object}   [props.battleCtx={}]
 *   Contesto della battaglia: `{ terrSel, nomeImperoAvversario }`.
 *   Usato per mostrare il nome del territorio e dell'avversario nell'header.
 * @param {Function} [props.onConfirm]
 *   Callback `(playerTeam: WaifuBattleStat[], enemyTeam: WaifuBattleStat[]) => void`
 *   invocata quando entrambi i team sono pronti per cominciare la battaglia.
 */
export default function PickPhase({ roster5P = [], roster5E = [], isCpu = true, isOnlinePvP = false, battleCtx = {}, onConfirm }) {
  // pvpStep: usato per la reveal screen interna (CPU).
  // Valori possibili: 'picking' | 'cpuReveal'
  // La reveal interna (pvpStep === 'reveal') non è più raggiungibile.
  // pvpStep: usato solo internamente per tracciare lo stato della pick.
  // 'picking' = fase di selezione (l'unica fase visibile al giocatore)
  // In PvP online ogni giocatore sceglie sul proprio dispositivo — non esistono
  // step 'handoff' o 'p2pick'.
  const [pvpStep, setPvpStep] = useState('picking');

  // topOffset: altezza dell'header + tabs superiori, per non sovrapporre la UI sopra.
  // bottomOffset: altezza della bottom navbar (.bottom-nav-mobile), per non finire sotto la nav.
  // Entrambi vengono misurati dal DOM reale così si adattano a qualsiasi viewport.
  const [topOffset,    setTopOffset]    = useState(0);
  const [bottomOffset, setBottomOffset] = useState(0);
  useEffect(() => {
    const calcOffset = () => {
      const hdr   = document.querySelector('.hdr-root');
      const ntabs = document.querySelector('.ntabs-root');
      const bnav  = document.querySelector('.bottom-nav-mobile');
      setTopOffset((hdr  ? hdr.getBoundingClientRect().height  : 0)
                 + (ntabs ? ntabs.getBoundingClientRect().height : 0));
      setBottomOffset(bnav ? bnav.getBoundingClientRect().height : 0);
    };
    calcOffset();
    window.addEventListener('resize', calcOffset);
    return () => window.removeEventListener('resize', calcOffset);
  }, []);

  // CPU pesca silenziosamente PICKS_RICHIESTI waifu casuali al mount (lazy initializer).
  // L'utente non vedrà mai queste scelte fino all'inizio della battaglia.
  const [cpuPicks] = useState(() => {
    const shuffled = [...roster5E].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, PICKS_RICHIESTI);
  });

  // Selezioni del giocatore 1: array di indici nel roster (in ordine di selezione → slot order).
  const [p1Slots, setP1Slots] = useState([]); // indici in roster5P
  // NON esiste più un secondo giocatore sulla stessa schermata.

  // Riferimento al timer della reveal (usato per pulire il timeout se il componente smonta).
  const [revealTimer, setRevealTimer] = useState(null);

  // ── Logica di selezione slot ──────────────────────────────────────────────
  // Tap su una card: se è già selezionata la deseleziona, altrimenti la aggiunge
  // (fino a PICKS_RICHIESTI slot disponibili). Principio SRP: logica pura, nessun side effect.
  const handleTapRoster = (idx, slots, setSlots, maxRoster) => {
    const pos = slots.indexOf(idx);
    if (pos !== -1) {
      // Deseleziona — rimuove l'indice dagli slot mantenendo l'ordine degli altri
      setSlots(slots.filter((_, i) => i !== pos));
    } else if (slots.length < PICKS_RICHIESTI) {
      setSlots([...slots, idx]);
    }
  };

  // ── Costruzione del team WaifuBattleStat dagli indici selezionati ─────────
  // Principio SRP: responsabile SOLO della trasformazione roster[idx] → WaifuBattleStat.
  const buildTeam = (roster, picks) =>
    picks.map(idx => {
      const w = roster[idx];
      if (!w) return null;
      return initBattleWaifu(w, { livello: w.livello ?? 1 });
    }).filter(Boolean);

  // ── Handler conferma giocatore ──────────────────────────────────────────
  // Due percorsi a seconda della modalità:
  //   1. isOnlinePvP → chiama onConfirm immediatamente (sync via Firestore nel parent)
  //   2. CPU         → chiama onConfirm con il team CPU già estratto al mount
  const handleP1Confirm = () => {
    if (p1Slots.length < PICKS_RICHIESTI) return;
    const playerTeam = buildTeam(roster5P, p1Slots);
    if (isOnlinePvP) {
      // PvP Online: ogni giocatore sceglie sul proprio dispositivo.
      // Il team avversario è vuoto qui — arriverà tramite Firestore (gestito dal parent).
      onConfirm?.(playerTeam, []);
    } else {
      // Modalità CPU: l'avversario ha già pescato al mount, passiamo il suo team.
      const enemyTeam = cpuPicks.map(w => initBattleWaifu(w, { livello: w.livello ?? 1 }));
      onConfirm?.(playerTeam, enemyTeam);
    }
  };

  // handleP2Confirm rimosso: la modalità pass-the-device non esiste più.
  // In PvP online ogni giocatore è sul proprio dispositivo.

  // startRevealTimer: funzione rimossa (il reveal screen usato nel PvP pass-the-device
  // è stato eliminato insieme alla modalità stessa).

  // Cleanup del timer alla distruzione del componente
  useEffect(() => () => { if (revealTimer) clearTimeout(revealTimer); }, [revealTimer]);

  // ─────────────────────────────────────────────────────────────────────────
  // GUARD: roster insufficiente
  // Il giocatore ha meno di ROSTER_MIN waifu → mostra errore e blocca il draft.
  // ─────────────────────────────────────────────────────────────────────────
  if (roster5P.length < ROSTER_MIN) {
    return (
      <div style={S.root(topOffset, bottomOffset)}>
        <div style={{ ...S.header, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: '#ff4d4d', letterSpacing: 2 }}>
            ⚠ WAIFU INSUFFICIENTI
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>😔</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 14, color: '#eedcd4', lineHeight: 1.6 }}>
              Hai bisogno di almeno {ROSTER_MIN} waifu per partecipare alla pick phase.
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,.4)', marginTop: 8, letterSpacing: 1 }}>
              Apri bustine nella sezione Sbusta per ottenerne di più.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 'handoff' rimosso: la modalità pass-the-device è stata eliminata.
  // In PvP online ogni giocatore sceglie sul proprio dispositivo.

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: reveal / cpuReveal — schermata di rivelazione degli starter
  // Mostra il confronto "starter P1 vs starter P2/CPU" prima di entrare in arena.
  // Principio SRP: questo blocco gestisce SOLO l'UI della reveal interna.
  // Nota: la reveal esterna (più comune) è `RevealScreen` (named export).
  // ─────────────────────────────────────────────────────────────────────────
  // Nota: pvpStep 'reveal' e 'cpuReveal' non sono più usati nel flusso principale.
  // RevealScreen è ora un componente standalone (named export) usato dal parent.
  if (pvpStep === 'reveal' || pvpStep === 'cpuReveal') {
    const p1Active = roster5P[p1Slots[0]];
    const p2Active = cpuPicks[0]; // In CPU mode — isPvP rimosso
    const p1Bs = p1Active?._battleStats ?? p1Active?.battleStats ?? {};
    const p2Bs = p2Active?._battleStats ?? p2Active?.battleStats ?? {};
    const { terrSel, nomeImperoAvversario } = battleCtx;
    return (
      <div style={{ ...S.root(topOffset, bottomOffset), alignItems: 'center', justifyContent: 'center' }}>
        {terrSel && (
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#f5a623', letterSpacing: 2, marginBottom: 12 }}>
            ⚔ {terrSel.nome}
          </div>
        )}
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700, color: '#eedcd4', letterSpacing: 3, marginBottom: 20, textAlign: 'center' }}>
          RIVELAZIONE!
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Starter del giocatore — slot 0 = prima waifu selezionata = quella che entra in campo */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#00C8FF', letterSpacing: 2, marginBottom: 6 }}>TU</div>
            <div style={{ width: 90, height: 135, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(0,200,255,.4)', background: 'rgba(6,3,15,.8)' }}>
              {p1Active?.asset_statica
                ? <img src={p1Active.asset_statica} alt={p1Active.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28, opacity: 0.2 }}>◈</div>
              }
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#eedcd4', marginTop: 6, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p1Active?.nome ?? '—'}
            </div>
            <TypeBadge type={p1Bs.type ?? 'Arcana'} />
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#ff2d78', marginBottom: 30 }}>VS</div>
          {/* Starter avversario/CPU */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#FF3355', letterSpacing: 2, marginBottom: 6 }}>
              {nomeImperoAvversario ?? 'CPU'}
            </div>
            <div style={{ width: 90, height: 135, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,50,80,.4)', background: 'rgba(6,3,15,.8)' }}>
              {p2Active?.asset_statica
                ? <img src={p2Active.asset_statica} alt={p2Active.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28, opacity: 0.2 }}>◈</div>
              }
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#eedcd4', marginTop: 6, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p2Active?.nome ?? '—'}
            </div>
            <TypeBadge type={p2Bs.type ?? 'Arcana'} />
          </div>
        </div>
        <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,.4)', marginTop: 20 }}>
          La battaglia sta per cominciare…
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP PRINCIPALE: picking
  // Un solo giocatore per dispositivo — non esiste più il doppio turno
  // (pass-the-device rimosso). Ogni giocatore vede il proprio roster e
  // quello dell'avversario (in sola lettura, senza statistiche).
  // ─────────────────────────────────────────────────────────────────────────
  const activeRoster   = roster5P;
  const activeSlots    = p1Slots;
  const setActiveSlots = setP1Slots;
  const handleConfirm  = handleP1Confirm;
  const playerLabel    = 'TU';
  const opponentRoster = roster5E;

  const { terrSel, nomeImperoAvversario } = battleCtx;

  return (
    <div style={S.root(topOffset, bottomOffset)}>
      {/* ── Header fisso ──────────────────────────────────────────────────────
          Mostra il titolo "SCELTA TEAM", il contesto battaglia e il badge
          che indica quale giocatore sta selezionando (P1 o P2). */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700, color: '#f5a623', letterSpacing: 2 }}>
              ⚔ SCELTA TEAM
            </div>
            {terrSel && (
              <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,.4)', marginTop: 2, letterSpacing: 1 }}>
                {terrSel.nome} · {nomeImperoAvversario ?? 'CPU'}
              </div>
            )}
          </div>
          {/* Badge giocatore — sempre il giocatore corrente sul questo dispositivo */}
          <div style={{
            fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700,
            color: '#00C8FF',
            background: 'rgba(0,200,255,.10)',
            border: '1px solid rgba(0,200,255,.3)',
            borderRadius: 8, padding: '4px 10px',
          }}>{playerLabel}</div>
        </div>
        {/* Sottotitolo: istruzione + contatore selezioni correnti */}
        <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,.5)', marginTop: 6 }}>
          Scegli {PICKS_RICHIESTI} waifu in ordine — la prima entra subito in campo.
          {' '}<span style={{ color: '#00e676', fontWeight: 700 }}>{activeSlots.length}/{PICKS_RICHIESTI} selezionate</span>
        </div>
      </div>

      {/* ── Body scrollabile ───────────────────────────────────────────────── */}
      <div style={S.body}>
        {/* Sezione: roster del giocatore attivo (selezionabile) */}
        <div style={S.section}>
          <div style={S.label}>IL TUO ROSTER</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {activeRoster.map((w, idx) => {
              const slotPos = activeSlots.indexOf(idx);
              return (
                <WaifuPickCard
                  key={w.id ?? idx}
                  waifu={w}
                  slot={slotPos !== -1 ? slotPos + 1 : null}
                  selectable
                  onTap={() => handleTapRoster(idx, activeSlots, setActiveSlots)}
                />
              );
            })}
          </div>
        </div>

        {/* Sezione: roster avversario (sola lettura, statistiche nascoste per mantenere la segretezza) */}
        <div style={S.section}>
          <div style={S.label}>ROSTER AVVERSARIO — {nomeImperoAvversario ?? 'CPU'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {opponentRoster.map((w, idx) => (
              <WaifuPickCard key={w.id ?? idx} waifu={w} slot={null} selectable={false} onTap={null} hideStats={true} />
            ))}
          </div>
          {isCpu && (
            <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(238,232,220,.35)', marginTop: 6, textAlign: 'center' }}>
              La CPU ha già scelto il suo team — vedrai quale solo all'inizio della battaglia.
            </div>
          )}
        </div>

        {/* ── Bottone CONFERMA — sticky dentro il body scrollabile ──────────────
            Usare `position: sticky; bottom: 0` dentro il contenitore scroll è
            più affidabile di un footer esterno su mobile:
            - iOS Safari: il footer fisso esterno può finire sotto l'home indicator
            - Android: la barra di navigazione può coprire il bottom fisso
            Con sticky il bottone scorre con il contenuto ma si ferma in fondo
            all'area visibile dello scroll — sempre raggiungibile con uno swipe. */}
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: '10px 0 12px',
          background: 'rgba(6,3,15,.96)',
          borderTop: '1px solid rgba(255,255,255,.07)',
          marginTop: 8,
        }}>
          <button
            style={S.confirmBtn(activeSlots.length === PICKS_RICHIESTI)}
            onClick={activeSlots.length === PICKS_RICHIESTI ? handleConfirm : undefined}
          >
            {activeSlots.length === PICKS_RICHIESTI
              ? '⚔ CONFERMA TEAM'
              : `SCEGLI ANCORA ${PICKS_RICHIESTI - activeSlots.length} WAIFU`}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMED EXPORT: RevealScreen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schermata di rivelazione standalone degli starter.
 * Usata quando entrambi i pick sono noti (es. dopo PickPhase vs CPU o PvP online).
 * Mostra il confronto "starter del giocatore VS starter dell'avversario" con
 * un pulsante per avviare la battaglia.
 *
 * Principio SRP: componente autonomo responsabile SOLO della schermata di reveal.
 * Non gestisce logica di pick né stato di draft.
 *
 * @param {Object}   props
 * @param {Object}   props.myStarter         - Documento waifu del giocatore (slot 0 del team).
 * @param {Object}   props.opponentStarter   - Documento waifu dell'avversario (slot 0 del team).
 * @param {string}   [props.myName='Tu']     - Nome del giocatore visualizzato sopra il suo starter.
 * @param {string}   [props.opponentName='CPU'] - Nome dell'avversario visualizzato sopra il suo starter.
 * @param {Function} [props.onStart]         - Callback invocata quando il giocatore preme "INIZIA LA BATTAGLIA".
 * @returns {JSX.Element}
 */
export function RevealScreen({ myStarter, opponentStarter, myName = 'Tu', opponentName = 'CPU', onStart }) {
  const myBs   = myStarter?._battleStats   ?? myStarter?.battleStats   ?? {};
  const oppBs  = opponentStarter?._battleStats ?? opponentStarter?.battleStats ?? {};

  const [topOffset, setTopOffset] = useState(0);
  useEffect(() => {
    const calcOffset = () => {
      const hdr   = document.querySelector('.hdr-root');
      const ntabs = document.querySelector('.ntabs-root');
      setTopOffset((hdr?.getBoundingClientRect().height ?? 0) + (ntabs?.getBoundingClientRect().height ?? 0));
    };
    calcOffset();
    window.addEventListener('resize', calcOffset);
    return () => window.removeEventListener('resize', calcOffset);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: topOffset, left: 0, right: 0, bottom: 0, zIndex: 45, overflow: 'hidden',
      background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, paddingBottom: 'env(safe-area-inset-bottom,0px)',
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', letterSpacing: 3, marginBottom: 10 }}>
        RIVELAZIONE
      </div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#eedcd4', letterSpacing: 4, marginBottom: 28, textAlign: 'center' }}>
        ⚔ BATTAGLIA!
      </div>

      {/* Confronto starter: My starter VS Opponent starter */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 28 }}>
        {/* Starter del giocatore */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#00C8FF', letterSpacing: 2, marginBottom: 6 }}>
            {myName}
          </div>
          <div style={{ width: 100, height: 148, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(0,200,255,.4)', background: 'rgba(6,3,15,.8)' }}>
            {myStarter?.asset_statica
              ? <img src={myStarter.asset_statica} alt={myStarter.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32, opacity: 0.2 }}>◈</div>
            }
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', marginTop: 6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myStarter?.nome ?? myStarter?.name ?? '—'}
          </div>
          <TypeBadge type={myBs.type ?? 'Arcana'} />
        </div>

        <div style={{ fontFamily: 'Orbitron', fontSize: 26, fontWeight: 900, color: '#ff2d78', marginBottom: 36 }}>VS</div>

        {/* Starter avversario */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#FF3355', letterSpacing: 2, marginBottom: 6 }}>
            {opponentName}
          </div>
          <div style={{ width: 100, height: 148, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,50,80,.4)', background: 'rgba(6,3,15,.8)' }}>
            {opponentStarter?.asset_statica
              ? <img src={opponentStarter.asset_statica} alt={opponentStarter.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32, opacity: 0.2 }}>◈</div>
            }
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', marginTop: 6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {opponentStarter?.nome ?? opponentStarter?.name ?? '—'}
          </div>
          <TypeBadge type={oppBs.type ?? 'Arcana'} />
        </div>
      </div>

      {/* Pulsante di avvio battaglia */}
      <button
        onClick={onStart}
        style={{
          padding: '14px 40px',
          background: 'linear-gradient(135deg,#f5a623,#d4880a)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700,
          color: '#000', letterSpacing: 2,
          boxShadow: 'rgba(245,166,35,0.4) 0px 8px 24px 0px',
        }}
      >
        ⚔ INIZIA LA BATTAGLIA
      </button>
    </div>
  );
}
