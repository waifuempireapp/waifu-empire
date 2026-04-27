import React, { useState, useMemo, useEffect } from 'react';

// ============================================================
// IMPERO DELLE WAIFU - Modulo 2: Collezione & Sbustamento
// ============================================================
// - Apertura pacchetti (5 carte: 2 waifu + 2 outfit + 1 posa)
// - Sistema rarità con probabilità gacha
// - Collezione con contatore copie + level up a 3 copie
// - Personalizzazione paper-doll (outfit a layer + pose)
// - Scarto outfit/pose per energia tette
// ============================================================

// --- CONFIGURAZIONE GIOCO ---

const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1, prob: 0.55 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2, prob: 0.27 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3, prob: 0.12 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4, prob: 0.05 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5, prob: 0.01 },
};

const COLORI_CAPELLI = {
  1:  { nome: 'Castano',          hex: '#6b4423' },
  2:  { nome: 'Nero',             hex: '#1a1a1a' },
  3:  { nome: 'Biondo',           hex: '#f4d35e' },
  4:  { nome: 'Rosso',            hex: '#c0392b' },
  5:  { nome: 'Argento',          hex: '#c0c0c0' },
  6:  { nome: 'Blu',              hex: '#3b82f6' },
  7:  { nome: 'Viola',            hex: '#8b5cf6' },
  8:  { nome: 'Rosa',             hex: '#ec4899' },
  9:  { nome: 'Bicolore',         hex: 'gradient-bicolor' },
  10: { nome: 'Fantasy',          hex: 'gradient-fantasy' },
};

const CATEGORIE_TETTE = {
  1: 'Petite', 2: 'Small', 3: 'Medium', 4: 'Full',
  5: 'Large', 6: 'Very Large', 7: 'Oppai Fantasy',
};

const SLOT_OUTFIT = {
  faccia: { nome: 'Faccia',  icon: '👁', desc: 'occhiali, cappelli, orecchini' },
  petto:  { nome: 'Petto',   icon: '✦',  desc: 'top, abiti, lingerie' },
  gambe:  { nome: 'Gambe',   icon: '⚘',  desc: 'pantaloni, gonne, calze' },
  piedi:  { nome: 'Piedi',   icon: '◈',  desc: 'scarpe, sandali, stivali' },
};

const STATS = [
  { key: 'tette',          label: 'Tette',         icon: '✦', max: 7   },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘', max: 44  },
  { key: 'eta',            label: 'Età',           icon: '⌛', max: 2000 },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿', max: 10  },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★', max: 250 },
];

// Catalogo waifu disponibili (in produzione: dal database / area admin)
const CATALOGO_WAIFU = [
  { id: 'w_aria',     nome: 'Aria',     rarita: 'leggendario', tette: 4, taglia_piedi: 36, eta: 19,   colore_capelli: 8  },
  { id: 'w_yumi',     nome: 'Yumi',     rarita: 'epico',       tette: 6, taglia_piedi: 38, eta: 21,   colore_capelli: 2  },
  { id: 'w_lyria',    nome: 'Lyria',    rarita: 'raro',        tette: 2, taglia_piedi: 35, eta: 18,   colore_capelli: 3  },
  { id: 'w_seraphina',nome: 'Seraphina',rarita: 'immersivo',   tette: 7, taglia_piedi: 39, eta: 850,  colore_capelli: 10 },
  { id: 'w_hoshino',  nome: 'Hoshino',  rarita: 'comune',      tette: 3, taglia_piedi: 37, eta: 22,   colore_capelli: 6  },
  { id: 'w_elara',    nome: 'Elara',    rarita: 'epico',       tette: 5, taglia_piedi: 37, eta: 24,   colore_capelli: 7  },
  { id: 'w_mei',      nome: 'Mei',      rarita: 'raro',        tette: 3, taglia_piedi: 36, eta: 20,   colore_capelli: 1  },
  { id: 'w_velvet',   nome: 'Velvet',   rarita: 'leggendario', tette: 6, taglia_piedi: 38, eta: 28,   colore_capelli: 9  },
  { id: 'w_sakura',   nome: 'Sakura',   rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 8  },
  { id: 'w_nyx',      nome: 'Nyx',      rarita: 'immersivo',   tette: 4, taglia_piedi: 39, eta: 1200, colore_capelli: 5  },
  { id: 'w_kira',     nome: 'Kira',     rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 23,   colore_capelli: 4  },
  { id: 'w_luna',     nome: 'Luna',     rarita: 'raro',        tette: 5, taglia_piedi: 36, eta: 19,   colore_capelli: 5  },
  { id: 'w_aoi',      nome: 'Aoi',      rarita: 'epico',       tette: 3, taglia_piedi: 35, eta: 25,   colore_capelli: 6  },
  { id: 'w_rin',      nome: 'Rin',      rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 2  },
  { id: 'w_kaede',    nome: 'Kaede',    rarita: 'raro',        tette: 4, taglia_piedi: 37, eta: 22,   colore_capelli: 7  },
];

// Catalogo outfit (in produzione: dal database / area admin)
const CATALOGO_OUTFIT = [
  { id: 'o_f1', nome: 'Occhiali da Lettura',     slot: 'faccia', rarita: 'comune',      colore: '#8b5cf6' },
  { id: 'o_f2', nome: 'Tiara Reale',             slot: 'faccia', rarita: 'leggendario', colore: '#f59e0b' },
  { id: 'o_f3', nome: 'Orecchini Cristallo',     slot: 'faccia', rarita: 'epico',       colore: '#06d6a0' },
  { id: 'o_f4', nome: 'Cappello a Tesa Larga',   slot: 'faccia', rarita: 'raro',        colore: '#ec4899' },
  { id: 'o_f5', nome: 'Maschera Mistica',        slot: 'faccia', rarita: 'immersivo',   colore: '#ec4899' },
  { id: 'o_p1', nome: 'Top Casual',              slot: 'petto',  rarita: 'comune',      colore: '#3b82f6' },
  { id: 'o_p2', nome: 'Abito Elegante',          slot: 'petto',  rarita: 'epico',       colore: '#a855f7' },
  { id: 'o_p3', nome: 'Bikini Estivo',           slot: 'petto',  rarita: 'raro',        colore: '#f59e0b' },
  { id: 'o_p4', nome: 'Corsetto Reale',          slot: 'petto',  rarita: 'leggendario', colore: '#ec4899' },
  { id: 'o_p5', nome: 'Armatura Eterea',         slot: 'petto',  rarita: 'immersivo',   colore: '#06d6a0' },
  { id: 'o_g1', nome: 'Jeans Classici',          slot: 'gambe',  rarita: 'comune',      colore: '#3b82f6' },
  { id: 'o_g2', nome: 'Gonna Plissé',            slot: 'gambe',  rarita: 'raro',        colore: '#ec4899' },
  { id: 'o_g3', nome: 'Calze Velate',            slot: 'gambe',  rarita: 'epico',       colore: '#8b5cf6' },
  { id: 'o_g4', nome: 'Pantaloni Sartoriali',    slot: 'gambe',  rarita: 'leggendario', colore: '#f59e0b' },
  { id: 'o_pi1', nome: 'Sneakers Bianche',       slot: 'piedi',  rarita: 'comune',      colore: '#c0c0c0' },
  { id: 'o_pi2', nome: 'Stivali al Ginocchio',   slot: 'piedi',  rarita: 'raro',        colore: '#1a1a1a' },
  { id: 'o_pi3', nome: 'Tacchi a Spillo',        slot: 'piedi',  rarita: 'epico',       colore: '#ec4899' },
  { id: 'o_pi4', nome: 'Sandali Dorati',         slot: 'piedi',  rarita: 'leggendario', colore: '#f59e0b' },
];

// Catalogo pose (specifiche per waifu)
const CATALOGO_POSE = [
  { id: 'po1', nome: 'In Piedi Classica',  waifu_id: 'w_aria',    rarita: 'comune'      },
  { id: 'po2', nome: 'Saluto Reale',       waifu_id: 'w_aria',    rarita: 'leggendario' },
  { id: 'po3', nome: 'Sguardo Intenso',    waifu_id: 'w_yumi',    rarita: 'epico'       },
  { id: 'po4', nome: 'Posa da Studio',     waifu_id: 'w_lyria',   rarita: 'raro'        },
  { id: 'po5', nome: 'Danza al Vento',     waifu_id: 'w_seraphina', rarita: 'immersivo' },
  { id: 'po6', nome: 'Sorriso Timido',     waifu_id: 'w_hoshino', rarita: 'comune'      },
  { id: 'po7', nome: 'Risveglio Magico',   waifu_id: 'w_elara',   rarita: 'epico'       },
  { id: 'po8', nome: 'Lettura Pensierosa', waifu_id: 'w_mei',     rarita: 'raro'        },
  { id: 'po9', nome: 'Trono di Velluto',   waifu_id: 'w_velvet',  rarita: 'leggendario' },
  { id: 'po10', nome: 'Riposo al Sole',    waifu_id: 'w_sakura',  rarita: 'comune'      },
];

// Mock collezione iniziale (in produzione: caricata dal backend)
const COLLEZIONE_INIZIALE = {
  waifu: {
    'w_aria':    { copie: 1, livello: 1, stat_bonus: {} },
    'w_hoshino': { copie: 2, livello: 1, stat_bonus: {} },
    'w_lyria':   { copie: 1, livello: 1, stat_bonus: {} },
    'w_kira':    { copie: 3, livello: 2, stat_bonus: { esperienza: 20 } }, // già livellata
    'w_yumi':    { copie: 1, livello: 1, stat_bonus: {} },
  },
  outfit: {
    'o_f1':  { quantita: 2 },
    'o_p1':  { quantita: 1 },
    'o_g1':  { quantita: 1 },
    'o_pi1': { quantita: 3 },
    'o_p3':  { quantita: 1 },
  },
  pose: {
    'po1':  { quantita: 1 },
    'po6':  { quantita: 1 },
  },
  // Outfit equipaggiati per ogni waifu
  equipaggiamento: {
    'w_aria': { faccia: null, petto: 'o_p3', gambe: null, piedi: 'o_pi1', posa: 'po1' },
    'w_hoshino': { faccia: 'o_f1', petto: null, gambe: null, piedi: null, posa: 'po6' },
  },
};

// ============================================================
// UTILS
// ============================================================
function pickRarita() {
  const r = Math.random();
  let cumul = 0;
  for (const [key, val] of Object.entries(RARITA)) {
    cumul += val.prob;
    if (r <= cumul) return key;
  }
  return 'comune';
}

function pickWaifu(esclusi = []) {
  const rarita = pickRarita();
  const candidati = CATALOGO_WAIFU.filter(w => w.rarita === rarita && !esclusi.includes(w.id));
  if (candidati.length === 0) {
    // fallback: qualunque waifu non esclusa
    const fallback = CATALOGO_WAIFU.filter(w => !esclusi.includes(w.id));
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return candidati[Math.floor(Math.random() * candidati.length)];
}

function pickOutfit() {
  const rarita = pickRarita();
  const candidati = CATALOGO_OUTFIT.filter(o => o.rarita === rarita);
  if (candidati.length === 0) return CATALOGO_OUTFIT[Math.floor(Math.random() * CATALOGO_OUTFIT.length)];
  return candidati[Math.floor(Math.random() * candidati.length)];
}

function pickPosa() {
  const rarita = pickRarita();
  const candidati = CATALOGO_POSE.filter(p => p.rarita === rarita);
  if (candidati.length === 0) return CATALOGO_POSE[Math.floor(Math.random() * CATALOGO_POSE.length)];
  return candidati[Math.floor(Math.random() * candidati.length)];
}

// Genera un pacchetto: 2 waifu + 2 outfit + 1 posa
function generaPacchetto(escludiDoppioniWaifu = false) {
  const esclusi = [];
  const w1 = pickWaifu();
  esclusi.push(w1.id);
  const w2 = pickWaifu(escludiDoppioniWaifu ? esclusi : []);
  return [
    { tipo: 'waifu', data: w1 },
    { tipo: 'waifu', data: w2 },
    { tipo: 'outfit', data: pickOutfit() },
    { tipo: 'outfit', data: pickOutfit() },
    { tipo: 'posa', data: pickPosa() },
  ];
}

// ============================================================
// COMPONENTI VISUALI
// ============================================================

function CartaWaifuMini({ waifu, copie = 1, livello = 1, onClick, evidenziato = false, statBonus = {} }) {
  const rar = RARITA[waifu.rarita];
  const cap = COLORI_CAPELLI[waifu.colore_capelli];
  let hairFill = cap.hex;
  if (cap.hex === 'gradient-bicolor') hairFill = 'url(#bicolor-mini)';
  if (cap.hex === 'gradient-fantasy') hairFill = 'url(#fantasy-mini)';
  const tetteEffettive = Math.min(7, waifu.tette + (statBonus.tette || 0));

  return (
    <div
      onClick={onClick}
      style={{
        width: 160,
        background: 'linear-gradient(160deg, #0f0a1e 0%, #1a0f2e 50%, #0a0515 100%)',
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 10,
        boxShadow: evidenziato
          ? `0 0 25px rgba(245,158,11,0.6)`
          : `0 0 12px ${rar.glow}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s',
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Badge livello */}
      {livello > 1 && (
        <div style={{
          position: 'absolute', top: 6, left: 6,
          background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
          color: '#000', fontWeight: 700, fontSize: 10,
          padding: '2px 8px', borderRadius: 10,
          fontFamily: 'Cinzel, serif', letterSpacing: 1, zIndex: 2,
        }}>
          LV {livello}
        </div>
      )}
      {/* Badge copie */}
      {copie > 1 && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: 'rgba(0,0,0,0.7)',
          color: '#f59e0b', fontWeight: 600, fontSize: 10,
          padding: '2px 6px', borderRadius: 8,
          border: '1px solid #f59e0b',
          zIndex: 2,
        }}>
          ×{copie}
        </div>
      )}
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: `1px solid ${rar.colore}40`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600 }}>{waifu.nome}</div>
        <div style={{ color: rar.colore, fontSize: 10 }}>{'★'.repeat(rar.stelle)}</div>
      </div>
      {/* Mini ritratto */}
      <svg viewBox="0 0 100 100" width="100%" height="100" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="bicolor-mini" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="fantasy-mini" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06d6a0" />
            <stop offset="50%" stopColor="#c0c0ff" />
            <stop offset="100%" stopColor="#ffafcc" />
          </linearGradient>
          <radialGradient id={`aura-${waifu.id}`}>
            <stop offset="0%" stopColor={rar.colore} stopOpacity="0.4" />
            <stop offset="100%" stopColor={rar.colore} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="55" rx="30" ry="45" fill={`url(#aura-${waifu.id})`} />
        <circle cx="50" cy="35" r="18" fill={hairFill} opacity="0.85" />
        <ellipse cx="50" cy="38" rx="11" ry="13" fill="#f5d5b5" opacity="0.9" />
        <g transform="translate(50, 65)">
          {[...Array(tetteEffettive)].map((_, i) => (
            <circle key={i} cx={(i - tetteEffettive / 2 + 0.5) * 3} cy={0} r={1.2} fill={rar.colore} opacity={0.9} />
          ))}
        </g>
      </svg>
      {/* Footer rarità */}
      <div style={{
        textAlign: 'center', fontSize: 9, padding: '4px 0',
        color: rar.colore, fontFamily: 'Cinzel, serif', letterSpacing: 2,
        background: 'rgba(0,0,0,0.4)',
      }}>
        {rar.nome.toUpperCase()}
      </div>
    </div>
  );
}

function CartaOutfit({ outfit, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[outfit.rarita];
  const slot = SLOT_OUTFIT[outfit.slot];
  return (
    <div
      onClick={onClick}
      style={{
        width: 130, padding: 10,
        background: `linear-gradient(160deg, #0f0a1e, ${rar.colore}15)`,
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s',
        position: 'relative',
        boxShadow: `0 0 12px ${rar.glow}`,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {quantita > 1 && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.7)', color: '#f59e0b',
          fontSize: 10, padding: '2px 6px', borderRadius: 8,
          border: '1px solid #f59e0b',
        }}>×{quantita}</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 36 }}>{slot.icon}</div>
        <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' }}>{slot.nome}</div>
      </div>
      <div style={{
        fontFamily: 'Cinzel, serif', fontSize: 11,
        textAlign: 'center', color: '#f5e6d3',
        marginBottom: 4, minHeight: 28,
      }}>
        {outfit.nome}
      </div>
      <div style={{ textAlign: 'center', color: rar.colore, fontSize: 10 }}>
        {'★'.repeat(rar.stelle)}
      </div>
    </div>
  );
}

function CartaPosa({ posa, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[posa.rarita];
  const waifuTarget = CATALOGO_WAIFU.find(w => w.id === posa.waifu_id);
  return (
    <div
      onClick={onClick}
      style={{
        width: 130, padding: 10,
        background: `linear-gradient(160deg, #0f0a1e, ${rar.colore}15)`,
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s',
        position: 'relative',
        boxShadow: `0 0 12px ${rar.glow}`,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {quantita > 1 && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.7)', color: '#f59e0b',
          fontSize: 10, padding: '2px 6px', borderRadius: 8,
          border: '1px solid #f59e0b',
        }}>×{quantita}</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 36 }}>⚜</div>
        <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' }}>POSA</div>
      </div>
      <div style={{
        fontFamily: 'Cinzel, serif', fontSize: 11,
        textAlign: 'center', color: '#f5e6d3',
        marginBottom: 4, minHeight: 28,
      }}>
        {posa.nome}
      </div>
      <div style={{ fontSize: 9, opacity: 0.6, textAlign: 'center', marginBottom: 4 }}>
        per {waifuTarget?.nome || '?'}
      </div>
      <div style={{ textAlign: 'center', color: rar.colore, fontSize: 10 }}>
        {'★'.repeat(rar.stelle)}
      </div>
    </div>
  );
}

// ============================================================
// VISTA: SBUSTAMENTO
// ============================================================
function VistaSbustamento({ pacchettiDisponibili, onApriPacchetto }) {
  const [stato, setStato] = useState('idle'); // idle | reveal
  const [carteRivelate, setCarteRivelate] = useState([]);
  const [indiceRivelato, setIndiceRivelato] = useState(-1);

  const apri = () => {
    if (pacchettiDisponibili <= 0) return;
    const carte = generaPacchetto();
    setCarteRivelate(carte);
    setIndiceRivelato(-1);
    setStato('reveal');
    onApriPacchetto(carte);
    // Reveal sequenziale
    carte.forEach((_, i) => {
      setTimeout(() => setIndiceRivelato(i), 500 + i * 700);
    });
  };

  const chiudi = () => {
    setStato('idle');
    setCarteRivelate([]);
    setIndiceRivelato(-1);
  };

  if (stato === 'reveal') {
    return (
      <div style={{ minHeight: '60vh', padding: 24 }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif', textAlign: 'center',
          fontSize: 28, letterSpacing: 4, marginTop: 0,
          background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          ✦ APERTURA PACCHETTO ✦
        </h2>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 16, marginTop: 32,
        }}>
          {carteRivelate.map((carta, i) => {
            const rivelata = i <= indiceRivelato;
            const rarita = RARITA[carta.data.rarita];
            return (
              <div key={i} style={{
                opacity: rivelata ? 1 : 0.3,
                transform: rivelata ? 'scale(1)' : 'scale(0.85)',
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: rivelata && (carta.data.rarita === 'leggendario' || carta.data.rarita === 'immersivo')
                  ? 'pulseStrong 1.2s ease-in-out infinite' : 'none',
              }}>
                {!rivelata ? (
                  <div style={{
                    width: 160, height: 230,
                    background: 'linear-gradient(135deg, #1a0a2e, #16213e)',
                    border: '2px solid rgba(168,85,247,0.5)',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 50, color: 'rgba(168,85,247,0.7)',
                  }}>?</div>
                ) : carta.tipo === 'waifu' ? (
                  <CartaWaifuMini waifu={carta.data} />
                ) : carta.tipo === 'outfit' ? (
                  <CartaOutfit outfit={carta.data} />
                ) : (
                  <CartaPosa posa={carta.data} />
                )}
              </div>
            );
          })}
        </div>
        {indiceRivelato >= carteRivelate.length - 1 && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button onClick={chiudi} style={btnPrimario}>CONTINUA</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <h2 style={{
        fontFamily: 'Cinzel, serif', fontSize: 32, letterSpacing: 4,
        background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 8,
      }}>
        SBUSTA UN PACCHETTO
      </h2>
      <p style={{ color: '#d4c5b9', textAlign: 'center', maxWidth: 480, lineHeight: 1.6 }}>
        Ogni pacchetto contiene <strong>5 carte</strong>: 2 waifu, 2 outfit e 1 posa.
        <br />
        <span style={{ fontSize: 12, opacity: 0.7 }}>Pacchetti disponibili: <strong style={{ color: '#f59e0b' }}>{pacchettiDisponibili}/2</strong> · Ricarica ogni 12h</span>
      </p>
      <div style={{ marginTop: 32, perspective: 1000 }}>
        <div
          onClick={apri}
          style={{
            width: 200, height: 290,
            background: 'linear-gradient(135deg, #2a0a3e 0%, #4a0a5e 50%, #1a0a2e 100%)',
            border: '3px solid #f59e0b',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: pacchettiDisponibili > 0 ? 'pointer' : 'not-allowed',
            opacity: pacchettiDisponibili > 0 ? 1 : 0.4,
            boxShadow: '0 0 40px rgba(245,158,11,0.4), inset 0 0 30px rgba(0,0,0,0.5)',
            transition: 'all 0.3s',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => { if (pacchettiDisponibili > 0) e.currentTarget.style.transform = 'rotateY(8deg) scale(1.03)' }}
          onMouseLeave={e => e.currentTarget.style.transform = 'rotateY(0) scale(1)'}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
            <pattern id="pkg-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20 0 L40 20 L20 40 L0 20 Z" fill="none" stroke="#f59e0b" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#pkg-pattern)" />
          </svg>
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>♛</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, letterSpacing: 4, color: '#f59e0b' }}>IMPERO</div>
            <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.7, marginTop: 4 }}>delle WAIFU</div>
            <div style={{
              marginTop: 24, padding: '6px 16px',
              background: 'rgba(0,0,0,0.5)', borderRadius: 20,
              fontSize: 10, letterSpacing: 2,
              color: pacchettiDisponibili > 0 ? '#06d6a0' : '#ef4444',
            }}>
              {pacchettiDisponibili > 0 ? 'TOCCA PER APRIRE' : 'NESSUN PACCHETTO'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VISTA: COLLEZIONE
// ============================================================
function VistaCollezione({ collezione, onSelezionaWaifu, onScarta, energia }) {
  const [tab, setTab] = useState('waifu'); // waifu | outfit | pose
  const [filtroRarita, setFiltroRarita] = useState('tutti');

  const waifuPossedute = useMemo(() => {
    return Object.entries(collezione.waifu).map(([id, dati]) => {
      const w = CATALOGO_WAIFU.find(x => x.id === id);
      return { ...w, ...dati };
    }).filter(w => filtroRarita === 'tutti' || w.rarita === filtroRarita);
  }, [collezione.waifu, filtroRarita]);

  const outfitPossesuti = useMemo(() => {
    return Object.entries(collezione.outfit).map(([id, dati]) => {
      const o = CATALOGO_OUTFIT.find(x => x.id === id);
      return { ...o, ...dati };
    }).filter(o => filtroRarita === 'tutti' || o.rarita === filtroRarita);
  }, [collezione.outfit, filtroRarita]);

  const posePossedute = useMemo(() => {
    return Object.entries(collezione.pose).map(([id, dati]) => {
      const p = CATALOGO_POSE.find(x => x.id === id);
      return { ...p, ...dati };
    }).filter(p => filtroRarita === 'tutti' || p.rarita === filtroRarita);
  }, [collezione.pose, filtroRarita]);

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'waifu', label: '👑 Waifu', count: Object.keys(collezione.waifu).length },
          { key: 'outfit', label: '✦ Outfit', count: Object.keys(collezione.outfit).length },
          { key: 'pose', label: '⚜ Pose', count: Object.keys(collezione.pose).length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              background: tab === t.key ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${tab === t.key ? '#f59e0b' : 'rgba(245,158,11,0.3)'}`,
              color: tab === t.key ? '#000' : '#f5e6d3',
              fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 2,
              borderRadius: 8, cursor: 'pointer', fontWeight: 600,
              transition: 'all 0.25s',
            }}
          >
            {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Filtro rarità */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {['tutti', 'comune', 'raro', 'epico', 'leggendario', 'immersivo'].map(r => (
          <button
            key={r}
            onClick={() => setFiltroRarita(r)}
            style={{
              padding: '4px 12px', fontSize: 11, letterSpacing: 1,
              background: filtroRarita === r ? (RARITA[r]?.colore || '#f59e0b') : 'transparent',
              color: filtroRarita === r ? '#000' : (RARITA[r]?.colore || '#f5e6d3'),
              border: `1px solid ${RARITA[r]?.colore || '#f5e6d3'}`,
              borderRadius: 14, cursor: 'pointer', fontWeight: 600,
              textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Energia info */}
      <div style={{ textAlign: 'center', marginBottom: 16, color: '#f59e0b', fontSize: 12, letterSpacing: 2, fontFamily: 'Cinzel, serif' }}>
        ✦ ENERGIA TETTE: {energia} / 10 ✦
      </div>

      {/* Contenuto tab */}
      {tab === 'waifu' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {waifuPossedute.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', padding: 40 }}>
              Nessuna waifu in questa categoria.
            </div>
          )}
          {waifuPossedute.map(w => (
            <div key={w.id} style={{ position: 'relative' }}>
              <CartaWaifuMini
                waifu={w} copie={w.copie} livello={w.livello}
                statBonus={w.stat_bonus}
                onClick={() => onSelezionaWaifu(w.id)}
              />
              {/* Indicatore copie verso level up */}
              <div style={{
                marginTop: 6, textAlign: 'center', fontSize: 10,
                color: w.copie >= 3 ? '#06d6a0' : '#a855f7',
                fontFamily: 'Cinzel, serif', letterSpacing: 1,
              }}>
                {w.copie >= 3 ? '⚡ LEVEL UP DISPONIBILE' : `${w.copie}/3 verso LV ${w.livello + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'outfit' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {outfitPossesuti.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', padding: 40 }}>
              Nessun outfit in questa categoria.
            </div>
          )}
          {outfitPossesuti.map(o => (
            <div key={o.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CartaOutfit outfit={o} quantita={o.quantita} />
              {o.quantita > 0 && (
                <button
                  onClick={() => onScarta('outfit', o.id, o.rarita)}
                  style={btnScarta}
                >
                  ↻ SCARTA (+{getEnergiaScarto(o.rarita)})
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'pose' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {posePossedute.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', padding: 40 }}>
              Nessuna posa in questa categoria.
            </div>
          )}
          {posePossedute.map(p => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CartaPosa posa={p} quantita={p.quantita} />
              {p.quantita > 0 && (
                <button
                  onClick={() => onScarta('pose', p.id, p.rarita)}
                  style={btnScarta}
                >
                  ↻ SCARTA (+{getEnergiaScarto(p.rarita)})
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VISTA: PERSONALIZZAZIONE WAIFU (paper doll)
// ============================================================
function VistaPersonalizzazione({ waifuId, collezione, onChiudi, onEquipaggia, onLevelUp }) {
  const waifu = CATALOGO_WAIFU.find(w => w.id === waifuId);
  const datiCollezione = collezione.waifu[waifuId];
  const equip = collezione.equipaggiamento[waifuId] || { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
  const [mostraLevelUp, setMostraLevelUp] = useState(false);
  const [statSelezionata, setStatSelezionata] = useState(null);

  if (!waifu || !datiCollezione) return null;

  const cap = COLORI_CAPELLI[waifu.colore_capelli];
  const rar = RARITA[waifu.rarita];
  let hairFill = cap.hex;
  if (cap.hex === 'gradient-bicolor') hairFill = 'url(#bicolor-detail)';
  if (cap.hex === 'gradient-fantasy') hairFill = 'url(#fantasy-detail)';

  const tetteEffettive = Math.min(7, waifu.tette + (datiCollezione.stat_bonus.tette || 0));

  const outfitDisponibiliPerSlot = (slot) => {
    return Object.entries(collezione.outfit)
      .map(([id, dati]) => ({ ...CATALOGO_OUTFIT.find(o => o.id === id), ...dati }))
      .filter(o => o.slot === slot);
  };

  const poseDisponibili = Object.entries(collezione.pose)
    .map(([id, dati]) => ({ ...CATALOGO_POSE.find(p => p.id === id), ...dati }))
    .filter(p => p.waifu_id === waifuId);

  const confermaLevelUp = () => {
    if (!statSelezionata) return;
    onLevelUp(waifuId, statSelezionata);
    setMostraLevelUp(false);
    setStatSelezionata(null);
  };

  const renderStatVal = (key) => {
    const base = waifu[key];
    const bonus = datiCollezione.stat_bonus[key] || 0;
    let display;
    if (key === 'tette') {
      const eff = Math.min(7, base + bonus);
      display = `${eff} (${CATEGORIE_TETTE[eff]})`;
    } else if (key === 'colore_capelli') {
      const eff = Math.min(10, base + bonus);
      display = `${eff} (${COLORI_CAPELLI[eff].nome})`;
    } else if (key === 'eta') {
      display = `${base + bonus} anni`;
    } else {
      display = `${base + bonus}`;
    }
    return { display, bonus };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      zIndex: 100, overflowY: 'auto',
      padding: 16,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        background: 'linear-gradient(160deg, #0f0a1e, #1a0f2e)',
        border: `2px solid ${rar.colore}`,
        borderRadius: 16, padding: 24,
        boxShadow: `0 0 60px ${rar.glow}`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{
              fontFamily: 'Cinzel, serif', fontSize: 32, margin: 0,
              color: rar.colore, letterSpacing: 3,
              textShadow: `0 0 12px ${rar.glow}`,
            }}>
              {waifu.nome}
            </h2>
            <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: 2, marginTop: 4 }}>
              {rar.nome.toUpperCase()} · LV {datiCollezione.livello} · ×{datiCollezione.copie} copie
            </div>
          </div>
          <button onClick={onChiudi} style={btnSecondario}>✕ CHIUDI</button>
        </div>

        {/* Level up disponibile? */}
        {datiCollezione.copie >= 3 && !mostraLevelUp && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(236,72,153,0.2))',
            border: '2px solid #f59e0b',
            borderRadius: 12, padding: 16,
            marginBottom: 20, textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#f59e0b', letterSpacing: 2 }}>
              ⚡ LEVEL UP DISPONIBILE ⚡
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, marginBottom: 12 }}>
              Hai 3 copie di {waifu.nome}: puoi farla salire a livello {datiCollezione.livello + 1} e potenziare una statistica.
            </div>
            <button onClick={() => setMostraLevelUp(true)} style={btnPrimario}>POTENZIA</button>
          </div>
        )}

        {/* Pannello level up */}
        {mostraLevelUp && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '2px solid #f59e0b',
            borderRadius: 12, padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, color: '#f59e0b', textAlign: 'center', marginBottom: 16 }}>
              SCEGLI LA STATISTICA DA POTENZIARE
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {STATS.map(s => {
                const cur = waifu[s.key] + (datiCollezione.stat_bonus[s.key] || 0);
                const incremento = s.key === 'tette' ? 1 : s.key === 'colore_capelli' ? 1 : s.key === 'eta' ? 5 : s.key === 'taglia_piedi' ? 1 : 20;
                const giaMax = (s.key === 'tette' && cur >= 7) || (s.key === 'colore_capelli' && cur >= 10);
                return (
                  <button
                    key={s.key}
                    disabled={giaMax}
                    onClick={() => setStatSelezionata(s.key)}
                    style={{
                      padding: '10px 14px',
                      background: statSelezionata === s.key ? '#f59e0b' : 'rgba(0,0,0,0.4)',
                      color: statSelezionata === s.key ? '#000' : '#f5e6d3',
                      border: `1px solid ${statSelezionata === s.key ? '#f59e0b' : 'rgba(245,158,11,0.4)'}`,
                      borderRadius: 8, cursor: giaMax ? 'not-allowed' : 'pointer',
                      opacity: giaMax ? 0.4 : 1,
                      fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 1,
                      fontWeight: 600,
                    }}
                  >
                    <div>{s.icon} {s.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>+{incremento}</div>
                  </button>
                );
              })}
            </div>
            {statSelezionata === 'tette' && (
              <div style={{
                marginTop: 12, padding: 10,
                background: 'rgba(236,72,153,0.15)',
                border: '1px solid #ec4899',
                borderRadius: 8, fontSize: 12, color: '#ec4899',
                textAlign: 'center',
              }}>
                ⚠ Aumentando "Tette" cambierà anche la categoria visiva del personaggio
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={() => { setMostraLevelUp(false); setStatSelezionata(null); }} style={btnSecondario}>ANNULLA</button>
              <button onClick={confermaLevelUp} disabled={!statSelezionata} style={{ ...btnPrimario, opacity: statSelezionata ? 1 : 0.4 }}>
                CONFERMA
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 1.5fr', gap: 24 }}>
          {/* Paper doll preview */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: '#f59e0b', fontFamily: 'Cinzel, serif', marginBottom: 8 }}>
              ANTEPRIMA
            </div>
            <div style={{
              background: `radial-gradient(ellipse at top, ${rar.colore}20, transparent 70%), linear-gradient(180deg, #0a0515, #1a0f2e)`,
              border: `1px solid ${rar.colore}40`,
              borderRadius: 12, padding: 16,
              minHeight: 380, position: 'relative',
            }}>
              <svg viewBox="0 0 200 320" width="100%" height="350" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="bicolor-detail" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="fantasy-detail" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06d6a0" />
                    <stop offset="50%" stopColor="#c0c0ff" />
                    <stop offset="100%" stopColor="#ffafcc" />
                  </linearGradient>
                  <radialGradient id="aura-detail">
                    <stop offset="0%" stopColor={rar.colore} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={rar.colore} stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Aura */}
                <ellipse cx="100" cy="160" rx="80" ry="140" fill="url(#aura-detail)" />
                {/* Capelli */}
                <circle cx="100" cy="60" r="38" fill={hairFill} opacity="0.9" />
                {/* Volto */}
                <ellipse cx="100" cy="65" rx="22" ry="26" fill="#f5d5b5" opacity="0.95" />
                {/* Slot faccia (occhiali/cappello) */}
                {equip.faccia && (
                  <g>
                    <rect x="80" y="55" width="40" height="6" rx="3" fill={CATALOGO_OUTFIT.find(o => o.id === equip.faccia)?.colore} opacity="0.9" />
                    <text x="100" y="46" textAnchor="middle" fontSize="6" fill={CATALOGO_OUTFIT.find(o => o.id === equip.faccia)?.colore} fontFamily="Cinzel">
                      {SLOT_OUTFIT.faccia.icon}
                    </text>
                  </g>
                )}
                {/* Corpo: torso */}
                <rect x="78" y="100" width="44" height="60" rx="6"
                      fill={equip.petto ? CATALOGO_OUTFIT.find(o => o.id === equip.petto)?.colore : '#f5d5b5'}
                      opacity="0.85" />
                {/* Indicatore stat tette (bolle decorative) */}
                <g transform="translate(100, 120)">
                  {[...Array(tetteEffettive)].map((_, i) => (
                    <circle key={i} cx={(i - tetteEffettive / 2 + 0.5) * 4} cy={0} r={2} fill={rar.colore} opacity={0.95} />
                  ))}
                </g>
                {/* Slot gambe */}
                <rect x="84" y="160" width="32" height="80" rx="4"
                      fill={equip.gambe ? CATALOGO_OUTFIT.find(o => o.id === equip.gambe)?.colore : '#f5d5b5'}
                      opacity="0.85" />
                {/* Slot piedi */}
                <rect x="80" y="240" width="40" height="14" rx="3"
                      fill={equip.piedi ? CATALOGO_OUTFIT.find(o => o.id === equip.piedi)?.colore : '#8b6f4d'}
                      opacity="0.85" />
                {/* Indicatore posa */}
                {equip.posa && (
                  <text x="100" y="295" textAnchor="middle" fontSize="9" fill={rar.colore} fontFamily="Cinzel" letterSpacing="2">
                    ⚜ {CATALOGO_POSE.find(p => p.id === equip.posa)?.nome}
                  </text>
                )}
              </svg>
            </div>
            {/* Statistiche */}
            <div style={{ marginTop: 12 }}>
              {STATS.map(s => {
                const { display, bonus } = renderStatVal(s.key);
                return (
                  <div key={s.key} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 10px', fontSize: 12,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 6, marginBottom: 4,
                  }}>
                    <span style={{ opacity: 0.7 }}>
                      <span style={{ color: rar.colore }}>{s.icon}</span> {s.label}
                    </span>
                    <span>
                      <strong>{display}</strong>
                      {bonus > 0 && <span style={{ color: '#06d6a0', marginLeft: 6 }}>(+{bonus})</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Slot equipaggiamento */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: '#f59e0b', fontFamily: 'Cinzel, serif', marginBottom: 8 }}>
              EQUIPAGGIAMENTO
            </div>

            {Object.entries(SLOT_OUTFIT).map(([slotKey, slotInfo]) => {
              const disponibili = outfitDisponibiliPerSlot(slotKey);
              const equipaggiato = equip[slotKey];
              return (
                <div key={slotKey} style={{
                  background: 'rgba(0,0,0,0.3)', borderRadius: 10,
                  padding: 12, marginBottom: 10,
                  border: '1px solid rgba(245,158,11,0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 1 }}>
                      {slotInfo.icon} {slotInfo.nome}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.5 }}>{slotInfo.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => onEquipaggia(waifuId, slotKey, null)}
                      style={{
                        ...btnSlot,
                        background: !equipaggiato ? '#f59e0b' : 'transparent',
                        color: !equipaggiato ? '#000' : '#f5e6d3',
                      }}
                    >
                      vuoto
                    </button>
                    {disponibili.map(o => (
                      <button
                        key={o.id}
                        onClick={() => onEquipaggia(waifuId, slotKey, o.id)}
                        style={{
                          ...btnSlot,
                          background: equipaggiato === o.id ? RARITA[o.rarita].colore : 'transparent',
                          color: equipaggiato === o.id ? '#000' : RARITA[o.rarita].colore,
                          border: `1px solid ${RARITA[o.rarita].colore}`,
                        }}
                      >
                        {o.nome} {o.quantita > 1 && `×${o.quantita}`}
                      </button>
                    ))}
                    {disponibili.length === 0 && (
                      <span style={{ fontSize: 11, opacity: 0.5, fontStyle: 'italic' }}>Nessun outfit posseduto per questo slot</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Slot posa */}
            <div style={{
              background: 'rgba(0,0,0,0.3)', borderRadius: 10,
              padding: 12, marginBottom: 10,
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 1 }}>⚜ Posa</div>
                <div style={{ fontSize: 10, opacity: 0.5 }}>specifiche per {waifu.nome}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => onEquipaggia(waifuId, 'posa', null)}
                  style={{
                    ...btnSlot,
                    background: !equip.posa ? '#f59e0b' : 'transparent',
                    color: !equip.posa ? '#000' : '#f5e6d3',
                  }}
                >
                  default
                </button>
                {poseDisponibili.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onEquipaggia(waifuId, 'posa', p.id)}
                    style={{
                      ...btnSlot,
                      background: equip.posa === p.id ? RARITA[p.rarita].colore : 'transparent',
                      color: equip.posa === p.id ? '#000' : RARITA[p.rarita].colore,
                      border: `1px solid ${RARITA[p.rarita].colore}`,
                    }}
                  >
                    {p.nome}
                  </button>
                ))}
                {poseDisponibili.length === 0 && (
                  <span style={{ fontSize: 11, opacity: 0.5, fontStyle: 'italic' }}>
                    Nessuna posa per questa waifu nei pacchetti aperti
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STILI HELPER
// ============================================================
const btnPrimario = {
  padding: '10px 24px',
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000', fontWeight: 600,
  fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 2,
  borderRadius: 8, cursor: 'pointer',
};
const btnSecondario = {
  padding: '8px 16px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.4)',
  color: '#f5e6d3',
  fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 2,
  borderRadius: 8, cursor: 'pointer',
};
const btnSlot = {
  padding: '4px 10px',
  fontSize: 10, letterSpacing: 1,
  borderRadius: 14, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  border: '1px solid rgba(245,158,11,0.4)',
  transition: 'all 0.2s',
};
const btnScarta = {
  padding: '3px 8px',
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(6,214,160,0.5)',
  color: '#06d6a0',
  fontSize: 9, letterSpacing: 1,
  borderRadius: 10, cursor: 'pointer',
};

function getEnergiaScarto(rarita) {
  return { comune: 1, raro: 2, epico: 3, leggendario: 5, immersivo: 8 }[rarita] || 1;
}

// ============================================================
// COMPONENTE PRINCIPALE
// ============================================================
export default function CollezioneSbustamento() {
  const [vistaAttiva, setVistaAttiva] = useState('sbustamento'); // sbustamento | collezione
  const [pacchettiDisponibili, setPacchettiDisponibili] = useState(2);
  const [collezione, setCollezione] = useState(COLLEZIONE_INIZIALE);
  const [waifuSelezionata, setWaifuSelezionata] = useState(null);
  const [energia, setEnergia] = useState(7);
  const [notifica, setNotifica] = useState(null);

  const mostraNotifica = (testo, colore = '#06d6a0') => {
    setNotifica({ testo, colore });
    setTimeout(() => setNotifica(null), 2500);
  };

  // Quando si apre un pacchetto, aggiungi tutto alla collezione
  const handleApriPacchetto = (carte) => {
    setPacchettiDisponibili(p => p - 1);
    setCollezione(prev => {
      const nuova = JSON.parse(JSON.stringify(prev));
      carte.forEach(carta => {
        if (carta.tipo === 'waifu') {
          const id = carta.data.id;
          if (nuova.waifu[id]) {
            nuova.waifu[id].copie += 1;
          } else {
            nuova.waifu[id] = { copie: 1, livello: 1, stat_bonus: {} };
          }
        } else if (carta.tipo === 'outfit') {
          const id = carta.data.id;
          if (nuova.outfit[id]) {
            nuova.outfit[id].quantita += 1;
          } else {
            nuova.outfit[id] = { quantita: 1 };
          }
        } else if (carta.tipo === 'posa') {
          const id = carta.data.id;
          if (nuova.pose[id]) {
            nuova.pose[id].quantita += 1;
          } else {
            nuova.pose[id] = { quantita: 1 };
          }
        }
      });
      return nuova;
    });
  };

  const handleScarta = (tipo, id, rarita) => {
    const guadagno = getEnergiaScarto(rarita);
    setCollezione(prev => {
      const nuova = JSON.parse(JSON.stringify(prev));
      if (nuova[tipo][id]) {
        nuova[tipo][id].quantita -= 1;
        if (nuova[tipo][id].quantita <= 0) delete nuova[tipo][id];
      }
      return nuova;
    });
    setEnergia(e => Math.min(10, e + guadagno));
    mostraNotifica(`+${guadagno} Energia Tette`);
  };

  const handleEquipaggia = (waifuId, slot, outfitId) => {
    setCollezione(prev => {
      const nuova = JSON.parse(JSON.stringify(prev));
      if (!nuova.equipaggiamento[waifuId]) {
        nuova.equipaggiamento[waifuId] = { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
      }
      nuova.equipaggiamento[waifuId][slot] = outfitId;
      return nuova;
    });
  };

  const handleLevelUp = (waifuId, statKey) => {
    setCollezione(prev => {
      const nuova = JSON.parse(JSON.stringify(prev));
      const w = nuova.waifu[waifuId];
      const incremento = statKey === 'tette' ? 1 : statKey === 'colore_capelli' ? 1 : statKey === 'eta' ? 5 : statKey === 'taglia_piedi' ? 1 : 20;
      w.copie -= 3;
      w.livello += 1;
      w.stat_bonus[statKey] = (w.stat_bonus[statKey] || 0) + incremento;
      return nuova;
    });
    mostraNotifica('Level up completato!', '#f59e0b');
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'radial-gradient(ellipse at top, #2a0a3e 0%, #0a0515 50%, #000 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f5e6d3', padding: '24px 8px',
      position: 'relative', overflow: 'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulseStrong {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px currentColor); }
          50% { transform: scale(1.04); filter: drop-shadow(0 0 35px currentColor); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Background hex */}
      <svg style={{ position: 'fixed', inset: 0, opacity: 0.06, pointerEvents: 'none' }} width="100%" height="100%">
        <defs>
          <pattern id="hex-bg" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="#a855f7" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex-bg)" />
      </svg>

      {/* Notifica */}
      {notifica && (
        <div style={{
          position: 'fixed', top: 20, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)',
          border: `1px solid ${notifica.colore}`,
          color: notifica.colore,
          padding: '10px 24px', borderRadius: 24,
          fontFamily: 'Cinzel, serif', letterSpacing: 2, fontSize: 13,
          zIndex: 200, animation: 'slideDown 0.3s ease-out',
          boxShadow: `0 0 25px ${notifica.colore}50`,
        }}>
          ✦ {notifica.testo} ✦
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(24px, 5vw, 38px)',
          fontWeight: 700, letterSpacing: 5, margin: 0,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #a855f7 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          IMPERO DELLE WAIFU
        </h1>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#a855f7', marginTop: 4 }}>
          ⚜ COLLEZIONE & SBUSTAMENTO ⚜
        </div>
      </div>

      {/* Tabs principali */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { key: 'sbustamento', label: '🎁 Sbustamento' },
          { key: 'collezione', label: '📚 Collezione' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setVistaAttiva(t.key)}
            style={{
              padding: '10px 24px',
              background: vistaAttiva === t.key
                ? 'linear-gradient(135deg, #f59e0b, #ec4899)'
                : 'rgba(0,0,0,0.4)',
              border: vistaAttiva === t.key ? 'none' : '1px solid rgba(245,158,11,0.3)',
              color: vistaAttiva === t.key ? '#000' : '#f5e6d3',
              fontFamily: 'Cinzel, serif', fontSize: 13,
              letterSpacing: 3, borderRadius: 10,
              cursor: 'pointer', fontWeight: 600,
              boxShadow: vistaAttiva === t.key ? '0 8px 25px rgba(245,158,11,0.3)' : 'none',
              transition: 'all 0.25s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenuto */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {vistaAttiva === 'sbustamento' && (
          <VistaSbustamento
            pacchettiDisponibili={pacchettiDisponibili}
            onApriPacchetto={handleApriPacchetto}
          />
        )}
        {vistaAttiva === 'collezione' && (
          <VistaCollezione
            collezione={collezione}
            energia={energia}
            onSelezionaWaifu={setWaifuSelezionata}
            onScarta={handleScarta}
          />
        )}
      </div>

      {/* Modale personalizzazione */}
      {waifuSelezionata && (
        <VistaPersonalizzazione
          waifuId={waifuSelezionata}
          collezione={collezione}
          onChiudi={() => setWaifuSelezionata(null)}
          onEquipaggia={handleEquipaggia}
          onLevelUp={handleLevelUp}
        />
      )}

      {/* Pannello debug per testare velocemente */}
      <div style={{
        position: 'fixed', bottom: 12, right: 12,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(168,85,247,0.4)',
        borderRadius: 8, padding: 8,
        fontSize: 11, fontFamily: 'monospace',
        display: 'flex', flexDirection: 'column', gap: 4,
        zIndex: 50,
      }}>
        <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1 }}>DEBUG</div>
        <button
          onClick={() => setPacchettiDisponibili(p => Math.min(2, p + 1))}
          style={{ ...btnSecondario, padding: '4px 8px', fontSize: 10 }}
        >
          +1 pacchetto
        </button>
        <button
          onClick={() => setEnergia(10)}
          style={{ ...btnSecondario, padding: '4px 8px', fontSize: 10 }}
        >
          Energia max
        </button>
      </div>
    </div>
  );
}
