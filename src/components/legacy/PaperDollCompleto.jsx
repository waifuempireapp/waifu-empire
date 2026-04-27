import React, { useState, useMemo, useEffect } from 'react';

// ============================================================
// IMPERO DELLE WAIFU - Modulo 4: Paper-Doll Completo
// ============================================================
// - Layering SVG strutturato (capelli back, corpo, gambe, scarpe,
//   top, capelli front, faccia) - pronto per asset reali
// - Sistema asset pluggable (basta valorizzare il campo `asset`)
// - Anteprima istantanea outfit prima dell'equipaggiamento
// - Pose come trasformazioni del corpo
// - Preset outfit (set salvati)
// - Roster waifu
// ============================================================

const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5 },
};

const COLORI_CAPELLI = {
  1:  { nome: 'Castano',  hex: '#6b4423', solid: '#6b4423' },
  2:  { nome: 'Nero',     hex: '#1a1a1a', solid: '#1a1a1a' },
  3:  { nome: 'Biondo',   hex: '#f4d35e', solid: '#f4d35e' },
  4:  { nome: 'Rosso',    hex: '#c0392b', solid: '#c0392b' },
  5:  { nome: 'Argento',  hex: '#c0c0c0', solid: '#c0c0c0' },
  6:  { nome: 'Blu',      hex: '#3b82f6', solid: '#3b82f6' },
  7:  { nome: 'Viola',    hex: '#8b5cf6', solid: '#8b5cf6' },
  8:  { nome: 'Rosa',     hex: '#ec4899', solid: '#ec4899' },
  9:  { nome: 'Bicolore', hex: 'gradient-bicolor', solid: '#ec4899' },
  10: { nome: 'Fantasy',  hex: 'gradient-fantasy', solid: '#06d6a0' },
};

const CATEGORIE_TETTE = {
  1: 'Petite', 2: 'Small', 3: 'Medium', 4: 'Full',
  5: 'Large', 6: 'Very Large', 7: 'Oppai Fantasy',
};

const SLOT_OUTFIT = {
  faccia: { nome: 'Faccia',  icon: '👁' },
  petto:  { nome: 'Petto',   icon: '✦' },
  gambe:  { nome: 'Gambe',   icon: '⚘' },
  piedi:  { nome: 'Piedi',   icon: '◈' },
};

// ============================================================
// CATALOGO (in produzione: dal database / area admin)
// Ogni elemento ha campo `asset` per l'integrazione futura
// ============================================================

const CATALOGO_WAIFU = [
  // asset: null  -> usa placeholder SVG. In futuro: '/assets/waifu/aria.png'
  { id: 'w_aria',     nome: 'Aria',     rarita: 'leggendario', tette: 4, taglia_piedi: 36, eta: 19,   colore_capelli: 8,  asset: null },
  { id: 'w_yumi',     nome: 'Yumi',     rarita: 'epico',       tette: 6, taglia_piedi: 38, eta: 21,   colore_capelli: 2,  asset: null },
  { id: 'w_lyria',    nome: 'Lyria',    rarita: 'raro',        tette: 2, taglia_piedi: 35, eta: 18,   colore_capelli: 3,  asset: null },
  { id: 'w_seraphina',nome: 'Seraphina',rarita: 'immersivo',   tette: 7, taglia_piedi: 39, eta: 850,  colore_capelli: 10, asset: null },
  { id: 'w_hoshino',  nome: 'Hoshino',  rarita: 'comune',      tette: 3, taglia_piedi: 37, eta: 22,   colore_capelli: 6,  asset: null },
  { id: 'w_kira',     nome: 'Kira',     rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 23,   colore_capelli: 4,  asset: null },
];

const CATALOGO_OUTFIT = [
  // Faccia
  { id: 'o_f1', nome: 'Occhiali da Lettura',     slot: 'faccia', rarita: 'comune',      colore: '#8b5cf6', forma: 'glasses', asset: null },
  { id: 'o_f2', nome: 'Tiara Reale',             slot: 'faccia', rarita: 'leggendario', colore: '#f59e0b', forma: 'tiara',   asset: null },
  { id: 'o_f3', nome: 'Orecchini Cristallo',     slot: 'faccia', rarita: 'epico',       colore: '#06d6a0', forma: 'earrings',asset: null },
  { id: 'o_f4', nome: 'Cappello a Tesa Larga',   slot: 'faccia', rarita: 'raro',        colore: '#ec4899', forma: 'hat',     asset: null },
  { id: 'o_f5', nome: 'Maschera Mistica',        slot: 'faccia', rarita: 'immersivo',   colore: '#ec4899', forma: 'mask',    asset: null },

  // Petto
  { id: 'o_p1', nome: 'Top Casual',              slot: 'petto',  rarita: 'comune',      colore: '#3b82f6', forma: 'tshirt',  asset: null },
  { id: 'o_p2', nome: 'Abito Elegante',          slot: 'petto',  rarita: 'epico',       colore: '#a855f7', forma: 'dress',   asset: null },
  { id: 'o_p3', nome: 'Bikini Estivo',           slot: 'petto',  rarita: 'raro',        colore: '#f59e0b', forma: 'bikini',  asset: null },
  { id: 'o_p4', nome: 'Corsetto Reale',          slot: 'petto',  rarita: 'leggendario', colore: '#ec4899', forma: 'corset',  asset: null },
  { id: 'o_p5', nome: 'Armatura Eterea',         slot: 'petto',  rarita: 'immersivo',   colore: '#06d6a0', forma: 'armor',   asset: null },

  // Gambe
  { id: 'o_g1', nome: 'Jeans Classici',          slot: 'gambe',  rarita: 'comune',      colore: '#3b82f6', forma: 'pants',   asset: null },
  { id: 'o_g2', nome: 'Gonna Plissé',            slot: 'gambe',  rarita: 'raro',        colore: '#ec4899', forma: 'skirt',   asset: null },
  { id: 'o_g3', nome: 'Calze Velate',            slot: 'gambe',  rarita: 'epico',       colore: '#8b5cf6', forma: 'tights',  asset: null },
  { id: 'o_g4', nome: 'Pantaloni Sartoriali',    slot: 'gambe',  rarita: 'leggendario', colore: '#f59e0b', forma: 'pants',   asset: null },

  // Piedi
  { id: 'o_pi1', nome: 'Sneakers Bianche',       slot: 'piedi',  rarita: 'comune',      colore: '#e5e5e5', forma: 'sneakers',asset: null },
  { id: 'o_pi2', nome: 'Stivali al Ginocchio',   slot: 'piedi',  rarita: 'raro',        colore: '#1a1a1a', forma: 'boots',   asset: null },
  { id: 'o_pi3', nome: 'Tacchi a Spillo',        slot: 'piedi',  rarita: 'epico',       colore: '#ec4899', forma: 'heels',   asset: null },
  { id: 'o_pi4', nome: 'Sandali Dorati',         slot: 'piedi',  rarita: 'leggendario', colore: '#f59e0b', forma: 'sandals', asset: null },
];

// Pose: ogni posa ha trasformazioni SVG per i layer del corpo
const CATALOGO_POSE = [
  { id: 'po_default', nome: 'Default', waifu_id: null, rarita: 'comune', transform: { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(0)', corpo: '' }, asset: null },
  { id: 'po_aria_1',  nome: 'Saluto Reale', waifu_id: 'w_aria', rarita: 'leggendario', transform: { braccio_sx: 'rotate(-30, 70, 130)', braccio_dx: 'rotate(20, 130, 130)', corpo: '' }, asset: null },
  { id: 'po_yumi_1',  nome: 'Sguardo Intenso', waifu_id: 'w_yumi', rarita: 'epico', transform: { braccio_sx: 'rotate(15, 70, 130)', braccio_dx: 'rotate(-15, 130, 130)', corpo: '' }, asset: null },
  { id: 'po_lyria_1', nome: 'Posa da Studio', waifu_id: 'w_lyria', rarita: 'raro', transform: { braccio_sx: 'rotate(-10, 70, 130)', braccio_dx: 'rotate(10, 130, 130)', corpo: '' }, asset: null },
  { id: 'po_sera_1',  nome: 'Danza al Vento', waifu_id: 'w_seraphina', rarita: 'immersivo', transform: { braccio_sx: 'rotate(-45, 70, 130)', braccio_dx: 'rotate(45, 130, 130)', corpo: '' }, asset: null },
  { id: 'po_hosh_1',  nome: 'Sorriso Timido', waifu_id: 'w_hoshino', rarita: 'comune', transform: { braccio_sx: 'rotate(8, 70, 130)', braccio_dx: 'rotate(-8, 130, 130)', corpo: '' }, asset: null },
  { id: 'po_kira_1',  nome: 'Mano sui Fianchi', waifu_id: 'w_kira', rarita: 'comune', transform: { braccio_sx: 'rotate(-25, 70, 130)', braccio_dx: 'rotate(25, 130, 130)', corpo: '' }, asset: null },
];

// Collezione iniziale (in futuro: backend)
const COLLEZIONE_INIZIALE = {
  waifu: {
    'w_aria':     { copie: 1, livello: 2, stat_bonus: { tette: 1 } },
    'w_yumi':     { copie: 2, livello: 1, stat_bonus: {} },
    'w_lyria':    { copie: 1, livello: 1, stat_bonus: {} },
    'w_seraphina':{ copie: 1, livello: 3, stat_bonus: { esperienza: 40 } },
    'w_hoshino':  { copie: 1, livello: 1, stat_bonus: {} },
    'w_kira':     { copie: 1, livello: 1, stat_bonus: {} },
  },
  outfit: {
    'o_f1':  { quantita: 2 }, 'o_f2': { quantita: 1 }, 'o_f3': { quantita: 1 }, 'o_f4': { quantita: 1 }, 'o_f5': { quantita: 1 },
    'o_p1':  { quantita: 1 }, 'o_p2': { quantita: 1 }, 'o_p3': { quantita: 2 }, 'o_p4': { quantita: 1 },
    'o_g1':  { quantita: 1 }, 'o_g2': { quantita: 1 }, 'o_g3': { quantita: 1 },
    'o_pi1': { quantita: 1 }, 'o_pi2': { quantita: 1 }, 'o_pi3': { quantita: 1 }, 'o_pi4': { quantita: 1 },
  },
  pose: {
    'po_aria_1':  { quantita: 1 },
    'po_yumi_1':  { quantita: 1 },
    'po_sera_1':  { quantita: 1 },
    'po_hosh_1':  { quantita: 1 },
    'po_kira_1':  { quantita: 1 },
  },
  equipaggiamento: {
    'w_aria':     { faccia: 'o_f2', petto: 'o_p4', gambe: 'o_g4', piedi: 'o_pi4', posa: 'po_aria_1' },
    'w_yumi':     { faccia: null,   petto: 'o_p1', gambe: 'o_g1', piedi: 'o_pi1', posa: 'po_yumi_1' },
    'w_lyria':    { faccia: 'o_f1', petto: null,   gambe: null,   piedi: null,    posa: null },
    'w_seraphina':{ faccia: 'o_f5', petto: 'o_p5', gambe: 'o_g3', piedi: 'o_pi3', posa: 'po_sera_1' },
    'w_hoshino':  { faccia: null,   petto: null,   gambe: null,   piedi: null,    posa: null },
    'w_kira':     { faccia: null,   petto: null,   gambe: null,   piedi: null,    posa: null },
  },
  preset: {
    'w_aria': [
      { id: 'preset_1', nome: 'Look Reale', equip: { faccia: 'o_f2', petto: 'o_p4', gambe: 'o_g4', piedi: 'o_pi4', posa: 'po_aria_1' } },
    ],
  },
};

// ============================================================
// PAPER-DOLL: il componente cuore del modulo
// Strutturato a layer SVG per essere sostituibile con immagini
// ============================================================

function PaperDoll({ waifu, equip, datiCollezione, dimensione = 240, sfondoRarita = false }) {
  if (!waifu) return null;
  const rar = RARITA[waifu.rarita];
  const cap = COLORI_CAPELLI[waifu.colore_capelli];
  const tetteEff = Math.min(7, waifu.tette + (datiCollezione?.stat_bonus?.tette || 0));

  // Risolvi outfit equipaggiati
  const oFaccia = equip?.faccia ? CATALOGO_OUTFIT.find(o => o.id === equip.faccia) : null;
  const oPetto  = equip?.petto  ? CATALOGO_OUTFIT.find(o => o.id === equip.petto)  : null;
  const oGambe  = equip?.gambe  ? CATALOGO_OUTFIT.find(o => o.id === equip.gambe)  : null;
  const oPiedi  = equip?.piedi  ? CATALOGO_OUTFIT.find(o => o.id === equip.piedi)  : null;
  const posa    = equip?.posa   ? CATALOGO_POSE.find(p => p.id === equip.posa)     : null;

  const t = posa?.transform || { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(0)' };

  // ID unici per i gradient (evitare collisioni in pagina)
  const uid = `${waifu.id}-${dimensione}`;

  // Larghezza/altezza del personaggio (proporzioni 1:1.6)
  const W = dimensione;
  const H = Math.round(dimensione * 1.5);

  // INTEGRAZIONE ASSET REALI:
  // Se waifu.asset è valorizzato, mostriamo l'immagine completa già renderizzata
  // (in produzione: pre-rendering server-side con outfit applicati, oppure layer
  //  composti via image href e maschere come spiegato nella guida finale)
  if (waifu.asset) {
    return (
      <div style={{ width: W, height: H, position: 'relative' }}>
        <img src={waifu.asset} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 200 320" width={W} height={H} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`bicolor-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id={`fantasy-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06d6a0" />
          <stop offset="50%" stopColor="#c0c0ff" />
          <stop offset="100%" stopColor="#ffafcc" />
        </linearGradient>
        <radialGradient id={`aura-${uid}`}>
          <stop offset="0%" stopColor={rar.colore} stopOpacity="0.5" />
          <stop offset="100%" stopColor={rar.colore} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sfondo-${uid}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor={rar.colore} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0a0515" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* === LAYER 0: SFONDO scenografico (solo in vetrina) === */}
      {sfondoRarita && (
        <rect width="200" height="320" fill={`url(#sfondo-${uid})`} />
      )}

      {/* === LAYER 1: AURA dietro al personaggio === */}
      <ellipse cx="100" cy="160" rx="80" ry="140" fill={`url(#aura-${uid})`} />

      {/* === LAYER 2: CAPELLI BACK (lunga chioma dietro) === */}
      <g>
        <path d="M 65,55 Q 50,120 60,200 L 80,200 Q 75,130 85,75 Z"
              fill={resolveCap(cap, uid)} opacity="0.85" />
        <path d="M 135,55 Q 150,120 140,200 L 120,200 Q 125,130 115,75 Z"
              fill={resolveCap(cap, uid)} opacity="0.85" />
      </g>

      {/* === LAYER 3: BRACCIO SINISTRO (con posa) === */}
      <g transform={t.braccio_sx}>
        <rect x="62" y="105" width="14" height="55" rx="6" fill="#f5d5b5" opacity="0.95" />
        <circle cx="69" cy="160" r="6" fill="#f5d5b5" opacity="0.95" />
      </g>

      {/* === LAYER 4: CORPO + GAMBE (base anatomica neutra) === */}
      <g>
        {/* Torso */}
        <path d="M 75,100 Q 75,90 100,90 Q 125,90 125,100 L 128,165 Q 100,170 72,165 Z"
              fill="#f5d5b5" opacity="0.95" />
        {/* Vita */}
        <path d="M 78,165 Q 100,170 122,165 L 122,180 Q 100,185 78,180 Z" fill="#f5d5b5" opacity="0.95" />
        {/* Gambe */}
        <rect x="80" y="180" width="16" height="80" rx="5" fill="#f5d5b5" opacity="0.95" />
        <rect x="104" y="180" width="16" height="80" rx="5" fill="#f5d5b5" opacity="0.95" />
      </g>

      {/* === LAYER 5: OUTFIT GAMBE === */}
      {oGambe && <OutfitGambe outfit={oGambe} />}

      {/* === LAYER 6: OUTFIT PIEDI === */}
      {oPiedi && <OutfitPiedi outfit={oPiedi} />}
      {!oPiedi && (
        <>
          <rect x="78" y="260" width="20" height="6" rx="2" fill="#8b6f4d" />
          <rect x="102" y="260" width="20" height="6" rx="2" fill="#8b6f4d" />
        </>
      )}

      {/* === LAYER 7: OUTFIT PETTO (sopra il corpo) === */}
      {oPetto && <OutfitPetto outfit={oPetto} tetteEff={tetteEff} />}

      {/* === LAYER 8: INDICATORE STAT TETTE (decorativo, sopra il top) === */}
      {/* Mostriamo dei "punti" decorativi che indicano la categoria, sempre visibili
           come segnale visivo della stat. Quando avrai gli asset veri, questo layer
           sparirà perché la silhouette stessa rifletterà la categoria. */}
      <g transform="translate(100, 130)" opacity="0.5">
        {[...Array(tetteEff)].map((_, i) => (
          <circle key={i} cx={(i - tetteEff / 2 + 0.5) * 4} cy={0} r={1.5} fill={rar.colore} />
        ))}
      </g>

      {/* === LAYER 9: COLLO === */}
      <rect x="92" y="78" width="16" height="14" fill="#f5d5b5" opacity="0.95" />

      {/* === LAYER 10: TESTA === */}
      <ellipse cx="100" cy="60" rx="22" ry="26" fill="#f5d5b5" opacity="0.98" />

      {/* === LAYER 11: OCCHI (espressione neutra) === */}
      <ellipse cx="91" cy="62" rx="2.5" ry="3.5" fill={cap.solid} />
      <ellipse cx="109" cy="62" rx="2.5" ry="3.5" fill={cap.solid} />
      <circle cx="91" cy="62" r="1" fill="#fff" opacity="0.7" />
      <circle cx="109" cy="62" r="1" fill="#fff" opacity="0.7" />
      {/* Bocca */}
      <path d="M 96,72 Q 100,75 104,72" stroke="#c47b7b" strokeWidth="1.2" fill="none" />

      {/* === LAYER 12: CAPELLI FRONT (frangia + ciuffi davanti) === */}
      <g>
        <path d="M 78,40 Q 100,30 122,40 L 125,55 Q 110,52 100,55 Q 90,52 75,55 Z"
              fill={resolveCap(cap, uid)} />
        <path d="M 80,55 Q 85,68 78,80" fill={resolveCap(cap, uid)} opacity="0.9" />
        <path d="M 120,55 Q 115,68 122,80" fill={resolveCap(cap, uid)} opacity="0.9" />
      </g>

      {/* === LAYER 13: BRACCIO DESTRO (con posa, davanti) === */}
      <g transform={t.braccio_dx}>
        <rect x="124" y="105" width="14" height="55" rx="6" fill="#f5d5b5" opacity="0.95" />
        <circle cx="131" cy="160" r="6" fill="#f5d5b5" opacity="0.95" />
      </g>

      {/* === LAYER 14: ACCESSORI FACCIA (sopra tutto) === */}
      {oFaccia && <OutfitFaccia outfit={oFaccia} />}

      {/* === LAYER 15: NOME POSA (etichetta in basso, solo se non default) === */}
      {posa && posa.id !== 'po_default' && sfondoRarita && (
        <text x="100" y="305" textAnchor="middle" fontSize="9" fill={rar.colore}
              fontFamily="Cinzel, serif" letterSpacing="2" opacity="0.8">
          ⚜ {posa.nome}
        </text>
      )}
    </svg>
  );
}

// Helper: risolve fill capelli (gestendo gradient)
function resolveCap(cap, uid) {
  if (cap.hex === 'gradient-bicolor') return `url(#bicolor-${uid})`;
  if (cap.hex === 'gradient-fantasy') return `url(#fantasy-${uid})`;
  return cap.hex;
}

// ============================================================
// COMPONENTI OUTFIT (layer SVG)
// In futuro: ognuno sostituibile con <image href={outfit.asset} ... />
// ============================================================

function OutfitFaccia({ outfit }) {
  const c = outfit.colore;
  switch (outfit.forma) {
    case 'glasses':
      return (
        <g>
          <circle cx="91" cy="62" r="6" fill="none" stroke={c} strokeWidth="1.5" />
          <circle cx="109" cy="62" r="6" fill="none" stroke={c} strokeWidth="1.5" />
          <line x1="97" y1="62" x2="103" y2="62" stroke={c} strokeWidth="1.5" />
        </g>
      );
    case 'tiara':
      return (
        <g>
          <path d="M 78,40 L 88,32 L 95,38 L 100,28 L 105,38 L 112,32 L 122,40 Z" fill={c} stroke="#fff" strokeWidth="0.5" />
          <circle cx="100" cy="34" r="2" fill="#fff" />
        </g>
      );
    case 'earrings':
      return (
        <g>
          <circle cx="78" cy="65" r="2" fill={c} />
          <circle cx="122" cy="65" r="2" fill={c} />
        </g>
      );
    case 'hat':
      return (
        <g>
          <ellipse cx="100" cy="40" rx="35" ry="6" fill={c} opacity="0.9" />
          <path d="M 85,40 Q 100,15 115,40 Z" fill={c} />
        </g>
      );
    case 'mask':
      return (
        <g>
          <path d="M 80,58 Q 100,55 120,58 L 118,68 Q 100,72 82,68 Z" fill={c} opacity="0.85" />
          <ellipse cx="91" cy="62" rx="3" ry="2" fill="#0a0515" />
          <ellipse cx="109" cy="62" rx="3" ry="2" fill="#0a0515" />
        </g>
      );
    default: return null;
  }
}

function OutfitPetto({ outfit, tetteEff }) {
  const c = outfit.colore;
  // La forma del top si adatta leggermente alla taglia tette (più ampio se più alta)
  const expand = (tetteEff - 1) * 0.5;
  switch (outfit.forma) {
    case 'tshirt':
      return (
        <path d={`M ${72 - expand},100 Q ${75 - expand},90 100,90 Q ${125 + expand},90 ${128 + expand},100 L ${128 + expand},170 Q 100,175 ${72 - expand},170 Z`}
              fill={c} opacity="0.9" />
      );
    case 'dress':
      return (
        <g>
          <path d={`M ${72 - expand},100 Q 100,88 ${128 + expand},100 L 135,200 Q 100,210 65,200 Z`} fill={c} opacity="0.9" />
          <path d="M 90,100 Q 100,95 110,100 L 110,108 Q 100,112 90,108 Z" fill="#fff" opacity="0.4" />
        </g>
      );
    case 'bikini':
      return (
        <g>
          {/* Top */}
          <path d={`M ${82 - expand / 2},105 Q 100,98 ${118 + expand / 2},105 L ${116 + expand / 2},120 Q 100,125 ${84 - expand / 2},120 Z`}
                fill={c} opacity="0.95" />
          {/* Spalline */}
          <line x1={84 - expand / 2} y1="105" x2="80" y2="92" stroke={c} strokeWidth="2" />
          <line x1={116 + expand / 2} y1="105" x2="120" y2="92" stroke={c} strokeWidth="2" />
        </g>
      );
    case 'corset':
      return (
        <g>
          <path d={`M ${74 - expand},102 Q 100,92 ${126 + expand},102 L ${124 + expand},170 Q 100,175 ${76 - expand},170 Z`}
                fill={c} opacity="0.95" />
          {/* Lacci */}
          <line x1="100" y1="105" x2="100" y2="165" stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.7" />
          {/* Bordo dorato */}
          <path d={`M ${74 - expand},102 Q 100,92 ${126 + expand},102`} fill="none" stroke="#fbbf24" strokeWidth="1.2" />
        </g>
      );
    case 'armor':
      return (
        <g>
          <path d={`M ${72 - expand},100 Q 100,88 ${128 + expand},100 L ${130 + expand},172 Q 100,178 ${70 - expand},172 Z`}
                fill={c} opacity="0.9" />
          {/* Decorazioni armature */}
          <path d="M 100,95 L 95,115 L 100,110 L 105,115 Z" fill="#fbbf24" />
          <line x1="80" y1="135" x2="120" y2="135" stroke="#fbbf24" strokeWidth="0.8" opacity="0.7" />
        </g>
      );
    default: return null;
  }
}

function OutfitGambe({ outfit }) {
  const c = outfit.colore;
  switch (outfit.forma) {
    case 'pants':
      return (
        <g>
          <rect x="78" y="180" width="20" height="80" rx="3" fill={c} opacity="0.9" />
          <rect x="102" y="180" width="20" height="80" rx="3" fill={c} opacity="0.9" />
        </g>
      );
    case 'skirt':
      return (
        <path d="M 70,180 L 130,180 L 138,220 L 62,220 Z" fill={c} opacity="0.9" />
      );
    case 'tights':
      return (
        <g>
          <rect x="80" y="180" width="16" height="80" rx="4" fill={c} opacity="0.6" />
          <rect x="104" y="180" width="16" height="80" rx="4" fill={c} opacity="0.6" />
        </g>
      );
    default: return null;
  }
}

function OutfitPiedi({ outfit }) {
  const c = outfit.colore;
  switch (outfit.forma) {
    case 'sneakers':
      return (
        <g>
          <ellipse cx="88" cy="263" rx="11" ry="5" fill={c} />
          <ellipse cx="112" cy="263" rx="11" ry="5" fill={c} />
        </g>
      );
    case 'boots':
      return (
        <g>
          <rect x="78" y="240" width="20" height="25" rx="3" fill={c} />
          <rect x="102" y="240" width="20" height="25" rx="3" fill={c} />
        </g>
      );
    case 'heels':
      return (
        <g>
          <path d="M 78,260 L 100,260 L 96,266 L 82,266 Z" fill={c} />
          <path d="M 102,260 L 124,260 L 120,266 L 106,266 Z" fill={c} />
          <line x1="92" y1="266" x2="92" y2="275" stroke={c} strokeWidth="1.5" />
          <line x1="116" y1="266" x2="116" y2="275" stroke={c} strokeWidth="1.5" />
        </g>
      );
    case 'sandals':
      return (
        <g>
          <ellipse cx="88" cy="263" rx="11" ry="3" fill={c} />
          <ellipse cx="112" cy="263" rx="11" ry="3" fill={c} />
          <line x1="88" y1="258" x2="88" y2="263" stroke={c} strokeWidth="1.2" />
          <line x1="112" y1="258" x2="112" y2="263" stroke={c} strokeWidth="1.2" />
        </g>
      );
    default: return null;
  }
}

// ============================================================
// COMPONENTE PRINCIPALE
// ============================================================
export default function PaperDollCompleto() {
  const [collezione, setCollezione] = useState(COLLEZIONE_INIZIALE);
  const [waifuId, setWaifuId] = useState('w_aria');
  const [tabSlot, setTabSlot] = useState('petto'); // tab dell'inventario
  const [previewOutfit, setPreviewOutfit] = useState(null); // outfit in anteprima (non ancora equipaggiato)
  const [vetrinaAperta, setVetrinaAperta] = useState(false);
  const [notifica, setNotifica] = useState(null);
  const [nuovoPresetNome, setNuovoPresetNome] = useState('');

  const mostraNotifica = (testo, colore = '#06d6a0') => {
    setNotifica({ testo, colore });
    setTimeout(() => setNotifica(null), 2000);
  };

  const waifu = CATALOGO_WAIFU.find(w => w.id === waifuId);
  const datiW = collezione.waifu[waifuId];
  const equip = collezione.equipaggiamento[waifuId] || { faccia: null, petto: null, gambe: null, piedi: null, posa: null };

  // Equip preview: se preview attivo, sovrascrivi lo slot corrispondente
  const equipDisplay = useMemo(() => {
    if (!previewOutfit) return equip;
    if (previewOutfit.tipo === 'outfit') {
      return { ...equip, [previewOutfit.outfit.slot]: previewOutfit.outfit.id };
    }
    if (previewOutfit.tipo === 'posa') {
      return { ...equip, posa: previewOutfit.posa.id };
    }
    return equip;
  }, [equip, previewOutfit]);

  // Inventario per il tab attivo
  const inventarioTab = useMemo(() => {
    if (tabSlot === 'pose') {
      return Object.entries(collezione.pose)
        .map(([id, dati]) => ({ ...CATALOGO_POSE.find(p => p.id === id), ...dati }))
        .filter(p => p.waifu_id === waifuId);
    }
    return Object.entries(collezione.outfit)
      .map(([id, dati]) => ({ ...CATALOGO_OUTFIT.find(o => o.id === id), ...dati }))
      .filter(o => o.slot === tabSlot);
  }, [tabSlot, collezione, waifuId]);

  // Equipaggia
  const equipaggia = (slot, outfitId) => {
    setCollezione(prev => {
      const nuova = { ...prev };
      nuova.equipaggiamento = { ...nuova.equipaggiamento };
      nuova.equipaggiamento[waifuId] = { ...equip, [slot]: outfitId };
      return nuova;
    });
    setPreviewOutfit(null);
    if (outfitId) {
      const o = CATALOGO_OUTFIT.find(x => x.id === outfitId) || CATALOGO_POSE.find(p => p.id === outfitId);
      mostraNotifica(`Equipaggiato: ${o?.nome || ''}`);
    } else {
      mostraNotifica('Slot rimosso');
    }
  };

  const equipaggiaPosa = (posaId) => {
    setCollezione(prev => {
      const nuova = { ...prev };
      nuova.equipaggiamento = { ...nuova.equipaggiamento };
      nuova.equipaggiamento[waifuId] = { ...equip, posa: posaId };
      return nuova;
    });
    setPreviewOutfit(null);
  };

  // Preset: salva combinazione attuale
  const salvaPreset = () => {
    if (!nuovoPresetNome.trim()) {
      mostraNotifica('Inserisci un nome', '#ef4444');
      return;
    }
    setCollezione(prev => {
      const nuova = { ...prev };
      nuova.preset = { ...nuova.preset };
      const presetWaifu = nuova.preset[waifuId] || [];
      const nuovoPreset = {
        id: `preset_${Date.now()}`,
        nome: nuovoPresetNome.trim(),
        equip: { ...equip },
      };
      nuova.preset[waifuId] = [...presetWaifu, nuovoPreset];
      return nuova;
    });
    setNuovoPresetNome('');
    mostraNotifica('Preset salvato!');
  };

  const applicaPreset = (preset) => {
    setCollezione(prev => {
      const nuova = { ...prev };
      nuova.equipaggiamento = { ...nuova.equipaggiamento };
      nuova.equipaggiamento[waifuId] = { ...preset.equip };
      return nuova;
    });
    mostraNotifica(`Applicato: ${preset.nome}`);
  };

  const eliminaPreset = (presetId) => {
    setCollezione(prev => {
      const nuova = { ...prev };
      nuova.preset = { ...nuova.preset };
      nuova.preset[waifuId] = (nuova.preset[waifuId] || []).filter(p => p.id !== presetId);
      return nuova;
    });
    mostraNotifica('Preset eliminato');
  };

  const presetWaifu = collezione.preset?.[waifuId] || [];
  const waifuPossedute = Object.keys(collezione.waifu).map(id => CATALOGO_WAIFU.find(w => w.id === id)).filter(Boolean);

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'radial-gradient(ellipse at top, #2a0a3e 0%, #0a0515 50%, #000 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f5e6d3', padding: 16, position: 'relative',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .roster-item:hover { transform: translateX(4px); }
        .outfit-tile:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(245,158,11,0.3); }
      `}</style>

      {notifica && (
        <div style={{
          position: 'fixed', top: 16, left: '50%',
          background: 'rgba(0,0,0,0.92)',
          border: `1px solid ${notifica.colore}`, color: notifica.colore,
          padding: '10px 24px', borderRadius: 24,
          fontFamily: 'Cinzel, serif', letterSpacing: 2, fontSize: 12,
          zIndex: 200, animation: 'slideDown 0.3s ease-out',
          boxShadow: `0 0 25px ${notifica.colore}50`,
        }}>
          ✦ {notifica.testo} ✦
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 700, letterSpacing: 5, margin: 0,
          background: 'linear-gradient(135deg, #f59e0b, #ec4899, #a855f7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          IMPERO DELLE WAIFU
        </h1>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#a855f7', marginTop: 2 }}>
          ⚜ STUDIO DI PERSONALIZZAZIONE ⚜
        </div>
      </div>

      {/* Layout 3 colonne: Roster | Paper-doll | Inventario */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 200px) minmax(280px, 1.2fr) minmax(280px, 1.4fr)',
        gap: 12, maxWidth: 1400, margin: '0 auto',
      }} className="layout">

        {/* === COLONNA 1: ROSTER WAIFU === */}
        <div style={pannello}>
          <div style={titoloPannello}>👑 ROSTER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 600, overflowY: 'auto' }}>
            {waifuPossedute.map(w => {
              const dati = collezione.waifu[w.id];
              const rar = RARITA[w.rarita];
              const sel = w.id === waifuId;
              return (
                <div key={w.id}
                  className="roster-item"
                  onClick={() => { setWaifuId(w.id); setPreviewOutfit(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: 8,
                    background: sel ? `${rar.colore}25` : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${sel ? rar.colore : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.25s',
                    boxShadow: sel ? `0 0 12px ${rar.glow}` : 'none',
                  }}
                >
                  <div style={{ width: 32, height: 48 }}>
                    <PaperDoll waifu={w} equip={collezione.equipaggiamento[w.id]}
                      datiCollezione={dati} dimensione={32} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: rar.colore, letterSpacing: 1 }}>
                      {w.nome}
                    </div>
                    <div style={{ fontSize: 9, opacity: 0.6 }}>
                      LV {dati.livello} · ×{dati.copie}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === COLONNA 2: PAPER-DOLL === */}
        <div style={pannello}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={titoloPannello}>{waifu.nome}</div>
            <button onClick={() => setVetrinaAperta(true)} style={btnPiccolo}>
              🔍 VETRINA
            </button>
          </div>

          {/* Info waifu */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', marginBottom: 8,
            background: `${RARITA[waifu.rarita].colore}15`,
            border: `1px solid ${RARITA[waifu.rarita].colore}50`,
            borderRadius: 6, fontSize: 11,
          }}>
            <span style={{ color: RARITA[waifu.rarita].colore, fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>
              {RARITA[waifu.rarita].nome.toUpperCase()} {'★'.repeat(RARITA[waifu.rarita].stelle)}
            </span>
            <span style={{ opacity: 0.7 }}>LV {datiW.livello} · ×{datiW.copie}</span>
          </div>

          {/* Anteprima */}
          <div style={{
            background: `radial-gradient(ellipse at top, ${RARITA[waifu.rarita].colore}20, transparent 70%), linear-gradient(180deg, #0a0515, #1a0f2e)`,
            border: `1px solid ${RARITA[waifu.rarita].colore}40`,
            borderRadius: 10, padding: 10,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            minHeight: 380,
          }}>
            <PaperDoll waifu={waifu} equip={equipDisplay} datiCollezione={datiW} dimensione={240} />
          </div>

          {previewOutfit && (
            <div style={{
              marginTop: 8, padding: 8,
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid #f59e0b', borderRadius: 6,
              fontSize: 11, textAlign: 'center', animation: 'fadeIn 0.2s',
            }}>
              👁 Anteprima: <strong>{previewOutfit.outfit?.nome || previewOutfit.posa?.nome}</strong>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                <button onClick={() => {
                  if (previewOutfit.tipo === 'outfit') equipaggia(previewOutfit.outfit.slot, previewOutfit.outfit.id);
                  else equipaggiaPosa(previewOutfit.posa.id);
                }} style={btnPrimario}>EQUIPAGGIA</button>
                <button onClick={() => setPreviewOutfit(null)} style={btnSecondario}>ANNULLA</button>
              </div>
            </div>
          )}

          {/* Stat */}
          <div style={{ marginTop: 10 }}>
            {[
              { key: 'tette', label: 'Tette', icon: '✦' },
              { key: 'taglia_piedi', label: 'Taglia Piedi', icon: '⚘' },
              { key: 'eta', label: 'Età', icon: '⌛' },
              { key: 'colore_capelli', label: 'Capelli', icon: '✿' },
              { key: 'esperienza', label: 'Esperienza', icon: '★' },
            ].map(s => {
              const base = waifu[s.key];
              const bonus = datiW.stat_bonus[s.key] || 0;
              let display;
              if (s.key === 'tette') {
                const eff = Math.min(7, base + bonus);
                display = `${eff} (${CATEGORIE_TETTE[eff]})`;
              } else if (s.key === 'colore_capelli') {
                display = `${COLORI_CAPELLI[base + bonus]?.nome || COLORI_CAPELLI[base].nome}`;
              } else {
                display = base + bonus;
              }
              return (
                <div key={s.key} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '4px 8px', fontSize: 11,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 4, marginBottom: 3,
                }}>
                  <span style={{ opacity: 0.7 }}>
                    <span style={{ color: RARITA[waifu.rarita].colore }}>{s.icon}</span> {s.label}
                  </span>
                  <span>
                    <strong>{display}</strong>
                    {bonus > 0 && <span style={{ color: '#06d6a0', marginLeft: 4 }}>(+{bonus})</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* === COLONNA 3: INVENTARIO + PRESET === */}
        <div style={pannello}>
          <div style={titoloPannello}>🎒 INVENTARIO</div>

          {/* Slot tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {Object.entries(SLOT_OUTFIT).map(([slotKey, slotInfo]) => (
              <button key={slotKey}
                onClick={() => { setTabSlot(slotKey); setPreviewOutfit(null); }}
                style={{
                  padding: '6px 10px', fontSize: 11,
                  background: tabSlot === slotKey ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
                  color: tabSlot === slotKey ? '#000' : '#f5e6d3',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'Cinzel, serif', letterSpacing: 1, fontWeight: 600,
                }}
              >
                {slotInfo.icon} {slotInfo.nome}
              </button>
            ))}
            <button onClick={() => { setTabSlot('pose'); setPreviewOutfit(null); }}
              style={{
                padding: '6px 10px', fontSize: 11,
                background: tabSlot === 'pose' ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
                color: tabSlot === 'pose' ? '#000' : '#f5e6d3',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 6, cursor: 'pointer',
                fontFamily: 'Cinzel, serif', letterSpacing: 1, fontWeight: 600,
              }}
            >
              ⚜ Pose
            </button>
          </div>

          {/* Stato slot corrente */}
          {tabSlot !== 'pose' && (
            <div style={{
              padding: 8, marginBottom: 10,
              background: 'rgba(0,0,0,0.3)', borderRadius: 6,
              fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ opacity: 0.6 }}>Equipaggiato:</span>
              <span style={{ fontFamily: 'Cinzel, serif', color: '#f5e6d3' }}>
                {equip[tabSlot] ? CATALOGO_OUTFIT.find(o => o.id === equip[tabSlot])?.nome : '— vuoto —'}
              </span>
              {equip[tabSlot] && (
                <button onClick={() => equipaggia(tabSlot, null)} style={{ ...btnSecondario, padding: '2px 8px', fontSize: 9 }}>
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Griglia inventario */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 8, maxHeight: 360, overflowY: 'auto', padding: 4,
          }}>
            {inventarioTab.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', fontSize: 12 }}>
                Nessun {tabSlot === 'pose' ? 'a posa' : 'outfit'} per questo slot
              </div>
            )}
            {inventarioTab.map(item => {
              const rar = RARITA[item.rarita];
              const isEquip = tabSlot === 'pose' ? equip.posa === item.id : equip[tabSlot] === item.id;
              return (
                <div key={item.id}
                  className="outfit-tile"
                  onClick={() => setPreviewOutfit({
                    tipo: tabSlot === 'pose' ? 'posa' : 'outfit',
                    [tabSlot === 'pose' ? 'posa' : 'outfit']: item,
                  })}
                  style={{
                    padding: 8, background: `linear-gradient(160deg, #0f0a1e, ${rar.colore}15)`,
                    border: `2px solid ${isEquip ? '#f59e0b' : rar.colore}`,
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.25s',
                    boxShadow: isEquip ? '0 0 12px rgba(245,158,11,0.6)' : `0 0 6px ${rar.glow}`,
                    position: 'relative',
                  }}
                >
                  {item.quantita > 1 && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4,
                      background: 'rgba(0,0,0,0.7)', color: '#f59e0b',
                      fontSize: 9, padding: '1px 5px', borderRadius: 8,
                    }}>×{item.quantita}</div>
                  )}
                  {isEquip && (
                    <div style={{
                      position: 'absolute', top: 4, left: 4,
                      background: '#f59e0b', color: '#000',
                      fontSize: 8, padding: '1px 4px', borderRadius: 4, fontWeight: 700, letterSpacing: 1,
                    }}>ON</div>
                  )}
                  <div style={{ textAlign: 'center', fontSize: 24, marginBottom: 4 }}>
                    {tabSlot === 'pose' ? '⚜' : SLOT_OUTFIT[item.slot]?.icon}
                  </div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, textAlign: 'center', minHeight: 24 }}>
                    {item.nome}
                  </div>
                  <div style={{ textAlign: 'center', color: rar.colore, fontSize: 9, marginTop: 2 }}>
                    {'★'.repeat(rar.stelle)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* === SEZIONE PRESET === */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ ...titoloPannello, fontSize: 12, marginBottom: 8 }}>💾 PRESET OUTFIT</div>

            {presetWaifu.length === 0 && (
              <div style={{ fontSize: 11, opacity: 0.5, fontStyle: 'italic', marginBottom: 8 }}>
                Nessun preset salvato per {waifu.nome}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {presetWaifu.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 6, fontSize: 11,
                }}>
                  <span style={{ flex: 1, fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>{p.nome}</span>
                  <button onClick={() => applicaPreset(p)} style={btnPiccolo}>APPLICA</button>
                  <button onClick={() => eliminaPreset(p.id)} style={{ ...btnSecondario, padding: '3px 6px', fontSize: 9 }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={nuovoPresetNome}
                onChange={e => setNuovoPresetNome(e.target.value)}
                placeholder="Nome preset..."
                maxLength={20}
                style={{
                  flex: 1, padding: 6, fontSize: 11,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 6, color: '#f5e6d3',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <button onClick={salvaPreset} style={btnPiccolo}>SALVA</button>
            </div>
          </div>
        </div>
      </div>

      {/* === VETRINA FULL-SCREEN === */}
      {vetrinaAperta && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'fadeIn 0.3s',
        }} onClick={() => setVetrinaAperta(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: `radial-gradient(ellipse at top, ${RARITA[waifu.rarita].colore}30, #0a0515 70%)`,
            border: `2px solid ${RARITA[waifu.rarita].colore}`,
            borderRadius: 16, padding: 32, position: 'relative',
            maxWidth: 600, width: '100%',
            boxShadow: `0 0 80px ${RARITA[waifu.rarita].glow}`,
          }}>
            <button onClick={() => setVetrinaAperta(false)} style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.5)', border: 'none',
              color: '#f5e6d3', fontSize: 18, padding: '4px 10px',
              borderRadius: 6, cursor: 'pointer',
            }}>✕</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'Cinzel, serif', fontSize: 36,
                color: RARITA[waifu.rarita].colore, letterSpacing: 4,
                textShadow: `0 0 20px ${RARITA[waifu.rarita].glow}`,
              }}>
                {waifu.nome}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 3, marginTop: 4 }}>
                {RARITA[waifu.rarita].nome.toUpperCase()} · LV {datiW.livello}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <PaperDoll waifu={waifu} equip={equip} datiCollezione={datiW} dimensione={320} sfondoRarita={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STILI
// ============================================================
const pannello = {
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
  border: '1px solid rgba(168,85,247,0.3)',
  borderRadius: 12, padding: 12,
};

const titoloPannello = {
  fontFamily: 'Cinzel, serif',
  fontSize: 13, letterSpacing: 3,
  color: '#f59e0b', marginBottom: 10,
  borderBottom: '1px solid rgba(245,158,11,0.2)',
  paddingBottom: 6,
};

const btnPrimario = {
  padding: '6px 14px',
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000', fontWeight: 600,
  fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 2,
  borderRadius: 6, cursor: 'pointer',
};

const btnSecondario = {
  padding: '6px 12px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.4)',
  color: '#f5e6d3',
  fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 2,
  borderRadius: 6, cursor: 'pointer',
};

const btnPiccolo = {
  padding: '4px 10px',
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000',
  fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1.5,
  borderRadius: 4, cursor: 'pointer', fontWeight: 600,
};
