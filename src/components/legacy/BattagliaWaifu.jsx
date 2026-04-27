import React, { useState, useEffect, useMemo } from 'react';

// ============================================================
// IMPERO DELLE WAIFU - Modulo 1: Battaglia a Carte
// ============================================================
// Prototipo single-player vs CPU
// Tutte le meccaniche di battaglia descritte sono implementate
// ============================================================

// --- DATI DI GIOCO ---

const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5 },
};

// Scala colori capelli (1=meno raro, 10=più raro)
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
  10: { nome: 'Fantasy Gradient', hex: 'gradient-fantasy' },
};

const CATEGORIE_TETTE = {
  1: 'Petite',
  2: 'Small',
  3: 'Medium',
  4: 'Full',
  5: 'Large',
  6: 'Very Large',
  7: 'Oppai Fantasy',
};

// Mazzo demo: 5 waifu placeholder per il giocatore
// In futuro queste verranno dalla collezione dell'utente
const MAZZO_GIOCATORE_DEMO = [
  { id: 'p1', nome: 'Aria',     rarita: 'leggendario', tette: 4, taglia_piedi: 36, eta: 19,   colore_capelli: 8,  esperienza: 45  },
  { id: 'p2', nome: 'Yumi',     rarita: 'epico',       tette: 6, taglia_piedi: 38, eta: 21,   colore_capelli: 2,  esperienza: 80  },
  { id: 'p3', nome: 'Lyria',    rarita: 'raro',        tette: 2, taglia_piedi: 35, eta: 18,   colore_capelli: 3,  esperienza: 12  },
  { id: 'p4', nome: 'Seraphina',rarita: 'immersivo',   tette: 7, taglia_piedi: 39, eta: 850,  colore_capelli: 10, esperienza: 230 },
  { id: 'p5', nome: 'Hoshino',  rarita: 'comune',      tette: 3, taglia_piedi: 37, eta: 22,   colore_capelli: 6,  esperienza: 60  },
];

const MAZZO_CPU_DEMO = [
  { id: 'c1', nome: 'Elara',    rarita: 'epico',       tette: 5, taglia_piedi: 37, eta: 24,   colore_capelli: 7,  esperienza: 95  },
  { id: 'c2', nome: 'Mei',      rarita: 'raro',        tette: 3, taglia_piedi: 36, eta: 20,   colore_capelli: 1,  esperienza: 30  },
  { id: 'c3', nome: 'Velvet',   rarita: 'leggendario', tette: 6, taglia_piedi: 38, eta: 28,   colore_capelli: 9,  esperienza: 150 },
  { id: 'c4', nome: 'Sakura',   rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 8,  esperienza: 20  },
  { id: 'c5', nome: 'Nyx',      rarita: 'immersivo',   tette: 4, taglia_piedi: 39, eta: 1200, colore_capelli: 5,  esperienza: 200 },
];

const STATS = [
  { key: 'tette',          label: 'Tette',         icon: '✦' },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
  { key: 'eta',            label: 'Età',           icon: '⌛' },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
];

// ============================================================
// COMPONENTE: CartaWaifu (placeholder visivo astratto)
// ============================================================
function CartaWaifu({ waifu, rivelata = true, evidenziaStat = null, dimensione = 'normale', perdente = false }) {
  const rar = RARITA[waifu.rarita];
  const cap = COLORI_CAPELLI[waifu.colore_capelli];
  const taglia = CATEGORIE_TETTE[waifu.tette];

  const scale = dimensione === 'piccola' ? 0.7 : dimensione === 'grande' ? 1.15 : 1;
  const W = 240 * scale;
  const H = 360 * scale;

  if (!rivelata) {
    // Retro carta
    return (
      <div style={{
        width: W, height: H,
        background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)',
        border: `3px solid ${rar.colore}`,
        borderRadius: 14,
        boxShadow: `0 0 30px ${rar.glow}, inset 0 0 20px rgba(0,0,0,0.5)`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Cinzel, serif',
        color: rar.colore,
        fontSize: 14 * scale,
        letterSpacing: 4,
        overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
          <defs>
            <pattern id="diamond" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke={rar.colore} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diamond)" />
        </svg>
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: 48 * scale, marginBottom: 10 }}>♛</div>
          <div>IMPERO</div>
          <div style={{ fontSize: 10 * scale, opacity: 0.6, marginTop: 6 }}>delle WAIFU</div>
        </div>
      </div>
    );
  }

  // Determina il fill per i capelli
  let hairFill = cap.hex;
  if (cap.hex === 'gradient-bicolor') hairFill = 'url(#bicolor)';
  if (cap.hex === 'gradient-fantasy') hairFill = 'url(#fantasy)';

  return (
    <div style={{
      width: W, height: H,
      background: `linear-gradient(160deg, #0f0a1e 0%, #1a0f2e 50%, #0a0515 100%)`,
      border: `2px solid ${rar.colore}`,
      borderRadius: 14,
      boxShadow: `0 0 ${perdente ? 10 : 35}px ${rar.glow}, inset 0 0 30px rgba(0,0,0,0.6)`,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f5e6d3',
      filter: perdente ? 'grayscale(0.7) brightness(0.6)' : 'none',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Pattern decorativo di sfondo */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
        <defs>
          <linearGradient id="bicolor" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="fantasy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06d6a0" />
            <stop offset="50%" stopColor="#c0c0ff" />
            <stop offset="100%" stopColor="#ffafcc" />
          </linearGradient>
          <radialGradient id="aura">
            <stop offset="0%" stopColor={rar.colore} stopOpacity="0.4" />
            <stop offset="100%" stopColor={rar.colore} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50%" cy="35%" r="40%" fill="url(#aura)" />
      </svg>

      {/* Header: nome + rarità */}
      <div style={{
        padding: `${10 * scale}px ${14 * scale}px`,
        borderBottom: `1px solid ${rar.colore}40`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.4), transparent)',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 18 * scale,
          fontWeight: 600,
          letterSpacing: 1,
          textShadow: `0 0 8px ${rar.glow}`,
        }}>
          {waifu.nome}
        </div>
        <div style={{ color: rar.colore, fontSize: 14 * scale, letterSpacing: 1 }}>
          {'★'.repeat(rar.stelle)}
        </div>
      </div>

      {/* Ritratto placeholder (silhouette astratta) */}
      <div style={{ position: 'relative', height: H * 0.42, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
        <svg viewBox="0 0 100 100" width="80%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Silhouette astratta - solo forme stilizzate, no dettagli anatomici */}
          {/* Aura */}
          <ellipse cx="50" cy="55" rx="30" ry="45" fill="url(#aura)" />
          {/* Capelli (cerchio principale che mostra il colore) */}
          <circle cx="50" cy="35" r="18" fill={hairFill} opacity="0.85" />
          {/* Volto stilizzato (ovale neutro) */}
          <ellipse cx="50" cy="38" rx="11" ry="13" fill="#f5d5b5" opacity="0.9" />
          {/* "Indicatore stat tette" come icona astratta - solo visuale, non illustrazione */}
          <g transform="translate(50, 65)">
            {[...Array(waifu.tette)].map((_, i) => (
              <circle
                key={i}
                cx={(i - waifu.tette / 2 + 0.5) * 3}
                cy={0}
                r={1.2}
                fill={rar.colore}
                opacity={0.9}
              />
            ))}
          </g>
          {/* Decorazione: simbolo della rarità */}
          <text x="50" y="92" textAnchor="middle" fontSize="6" fill={rar.colore} fontFamily="Cinzel, serif" letterSpacing="2">
            {rar.nome.toUpperCase()}
          </text>
        </svg>
      </div>

      {/* Statistiche */}
      <div style={{
        padding: `${10 * scale}px ${14 * scale}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6 * scale,
        position: 'relative',
        zIndex: 2,
      }}>
        {STATS.map(stat => {
          const val = waifu[stat.key];
          let displayVal = val;
          if (stat.key === 'tette') displayVal = `${val} (${CATEGORIE_TETTE[val]})`;
          if (stat.key === 'colore_capelli') displayVal = `${val} (${COLORI_CAPELLI[val].nome})`;
          if (stat.key === 'eta') displayVal = `${val} anni`;
          if (stat.key === 'taglia_piedi') displayVal = `${val}`;
          const isHighlight = evidenziaStat === stat.key;
          return (
            <div key={stat.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${4 * scale}px ${8 * scale}px`,
              background: isHighlight ? `${rar.colore}30` : 'rgba(255,255,255,0.04)',
              border: isHighlight ? `1px solid ${rar.colore}` : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              fontSize: 11 * scale,
              transition: 'all 0.3s',
            }}>
              <span style={{ opacity: 0.75, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: rar.colore }}>{stat.icon}</span>
                {stat.label}
              </span>
              <span style={{ fontWeight: 600, color: isHighlight ? rar.colore : '#f5e6d3' }}>
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPALE: Battaglia
// ============================================================
export default function BattagliaWaifu() {
  // Fasi: 'intro' -> 'coin' -> 'play' -> 'reveal' -> 'roundEnd' -> 'gameEnd'
  const [fase, setFase] = useState('intro');
  const [turno, setTurno] = useState(null); // 'player' | 'cpu'
  const [round, setRound] = useState(1);
  const [punteggio, setPunteggio] = useState({ player: 0, cpu: 0 });

  // Mazzi: ogni waifu può essere usata solo una volta
  const [mazzoP, setMazzoP] = useState(MAZZO_GIOCATORE_DEMO);
  const [mazzoC, setMazzoC] = useState(MAZZO_CPU_DEMO);

  // Carte selezionate per il round corrente
  const [carteP, setCarteP] = useState(null);
  const [carteC, setCarteC] = useState(null);

  // Scelta stat e direzione
  const [statScelta, setStatScelta] = useState(null);
  const [direzione, setDirezione] = useState(null); // 'piu' | 'meno'

  // Risultato del round
  const [vincitoreRound, setVincitoreRound] = useState(null);

  // Coin flip iniziale
  const [coinResult, setCoinResult] = useState(null);

  // Flusso: avvio coin flip
  const avviaCoinFlip = () => {
    setFase('coin');
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'player' : 'cpu';
      setCoinResult(result);
      setTimeout(() => {
        setTurno(result);
        setFase('play');
      }, 1800);
    }, 200);
  };

  // Quando il giocatore sceglie una carta
  const scegliCartaPlayer = (carta) => {
    if (fase !== 'play') return;
    if (carteP) return;
    setCarteP(carta);
    // CPU sceglie la sua carta (random tra le sue rimanenti)
    const cpuPick = mazzoC[Math.floor(Math.random() * mazzoC.length)];
    setCarteC(cpuPick);
  };

  // Effetto: quando entrambe le carte sono in campo, il giocatore di turno sceglie stat
  // Se è il turno della CPU, la CPU sceglie automaticamente
  useEffect(() => {
    if (fase === 'play' && carteP && carteC && !statScelta && turno === 'cpu') {
      // CPU sceglie: trova la stat dove la sua carta è più "estrema" rispetto alla media
      setTimeout(() => {
        const stats = STATS.map(s => s.key);
        const statRandom = stats[Math.floor(Math.random() * stats.length)];
        const direzioneCPU = carteC[statRandom] >= carteP[statRandom] ? 'piu' : 'meno';
        setStatScelta(statRandom);
        setDirezione(direzioneCPU);
        setTimeout(() => risolviRound(statRandom, direzioneCPU), 1200);
      }, 1500);
    }
  }, [fase, carteP, carteC, turno, statScelta]);

  // Player conferma scelta stat + direzione
  const confermaStatPlayer = (stat, dir) => {
    setStatScelta(stat);
    setDirezione(dir);
    setTimeout(() => risolviRound(stat, dir), 800);
  };

  // Risolve il round confrontando le carte
  const risolviRound = (stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      const valP = carteP[stat];
      const valC = carteC[stat];
      let vincitore;
      if (valP === valC) {
        vincitore = 'pareggio';
      } else if (dir === 'piu') {
        vincitore = valP > valC ? 'player' : 'cpu';
      } else {
        vincitore = valP < valC ? 'player' : 'cpu';
      }
      setVincitoreRound(vincitore);

      // Aggiorna punteggio
      const nuovoPunteggio = { ...punteggio };
      if (vincitore === 'player') nuovoPunteggio.player++;
      if (vincitore === 'cpu') nuovoPunteggio.cpu++;
      setPunteggio(nuovoPunteggio);

      setFase('roundEnd');
    }, 1500);
  };

  // Avanza al prossimo round o termina la partita
  const prossimoRound = () => {
    // Rimuovi le carte usate
    const nuovoMazzoP = mazzoP.filter(w => w.id !== carteP.id);
    const nuovoMazzoC = mazzoC.filter(w => w.id !== carteC.id);
    setMazzoP(nuovoMazzoP);
    setMazzoC(nuovoMazzoC);

    // Verifica condizioni di fine partita: best of 5 = primo a 3 vince
    if (punteggio.player >= 3 || punteggio.cpu >= 3 || round >= 5) {
      setFase('gameEnd');
      return;
    }

    // Reset per il prossimo round e alterna turno
    setCarteP(null);
    setCarteC(null);
    setStatScelta(null);
    setDirezione(null);
    setVincitoreRound(null);
    setRound(r => r + 1);
    setTurno(t => t === 'player' ? 'cpu' : 'player');
    setFase('play');
  };

  const resetGioco = () => {
    setFase('intro');
    setTurno(null);
    setRound(1);
    setPunteggio({ player: 0, cpu: 0 });
    setMazzoP(MAZZO_GIOCATORE_DEMO);
    setMazzoC(MAZZO_CPU_DEMO);
    setCarteP(null);
    setCarteC(null);
    setStatScelta(null);
    setDirezione(null);
    setVincitoreRound(null);
    setCoinResult(null);
  };

  const vincitoreFinale = punteggio.player > punteggio.cpu ? 'player' : 'cpu';

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(ellipse at top, #2a0a3e 0%, #0a0515 50%, #000 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f5e6d3',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorazione di sfondo: griglia esagonale tenue */}
      <svg style={{ position: 'fixed', inset: 0, opacity: 0.08, pointerEvents: 'none' }} width="100%" height="100%">
        <defs>
          <pattern id="hex" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="#a855f7" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>

      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes flipIn {
          0% { transform: rotateY(180deg); opacity: 0; }
          100% { transform: rotateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes coinSpin {
          0% { transform: rotateY(0); }
          100% { transform: rotateY(2160deg); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
          50% { filter: drop-shadow(0 0 20px currentColor); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-enter { animation: flipIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        .coin-spin { animation: coinSpin 1.6s ease-out forwards; }
        .glow-anim { animation: glow 2s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.5s ease-out forwards; }
        .stat-btn {
          background: linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.15) 100%);
          border: 1px solid rgba(245,158,11,0.4);
          color: #f5e6d3;
          padding: 12px 18px;
          font-family: 'Cinzel', serif;
          font-size: 14px;
          letter-spacing: 1px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s;
        }
        .stat-btn:hover {
          background: linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.35) 100%);
          border-color: #f59e0b;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245,158,11,0.3);
        }
        .dir-btn {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(245,158,11,0.5);
          color: #f5e6d3;
          padding: 14px 24px;
          font-family: 'Cinzel', serif;
          font-size: 16px;
          letter-spacing: 2px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s;
          min-width: 120px;
        }
        .dir-btn:hover {
          background: rgba(245,158,11,0.2);
          transform: scale(1.05);
        }
      `}</style>

      {/* ====== HEADER ====== */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 700,
          letterSpacing: 6,
          margin: 0,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 40px rgba(245,158,11,0.3)',
        }}>
          IMPERO DELLE WAIFU
        </h1>
        <div style={{ fontSize: 12, letterSpacing: 4, color: '#a855f7', marginTop: 4 }}>
          ⚜ BATTAGLIA TERRITORIALE ⚜
        </div>
      </div>

      {/* ====== FASE: INTRO ====== */}
      {fase === 'intro' && (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '60px auto', animation: 'fadeUp 0.6s' }}>
          <div style={{
            padding: 32,
            background: 'rgba(168,85,247,0.05)',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 16,
            backdropFilter: 'blur(10px)',
          }}>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 24, marginTop: 0, color: '#f59e0b' }}>
              Dichiari Guerra?
            </h2>
            <p style={{ lineHeight: 1.7, color: '#d4c5b9' }}>
              Sfida la CPU al meglio di 5 round. Ogni round metterete in campo una waifu del vostro mazzo
              (5 waifu in totale, ognuna usabile <strong>solo una volta</strong>).
              <br /><br />
              A turno alternato, sceglierete una <strong>statistica</strong> e una <strong>direzione</strong> (più o meno).
              <br />
              Vince il round chi ha il valore corrispondente. Primo a 3 round vince la battaglia.
            </p>
            <button
              onClick={avviaCoinFlip}
              style={{
                marginTop: 20,
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
                border: 'none',
                color: '#000',
                fontFamily: 'Cinzel, serif',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 3,
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(245,158,11,0.4)',
              }}
            >
              LANCIA LA MONETA
            </button>
          </div>
        </div>
      )}

      {/* ====== FASE: COIN FLIP ====== */}
      {fase === 'coin' && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <div className="coin-spin" style={{
            width: 140, height: 140,
            margin: '0 auto',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fbbf24, #b45309)',
            boxShadow: '0 0 60px rgba(245,158,11,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            fontFamily: 'Cinzel, serif',
            color: '#3a1c00',
            fontWeight: 700,
          }}>
            ♛
          </div>
          <div style={{ marginTop: 24, fontFamily: 'Cinzel, serif', letterSpacing: 4, color: '#f59e0b' }}>
            {coinResult ? (coinResult === 'player' ? 'INIZI TU!' : 'INIZIA LA CPU') : 'LANCIO IN CORSO...'}
          </div>
        </div>
      )}

      {/* ====== FASE: GIOCO / REVEAL / ROUND END ====== */}
      {(fase === 'play' || fase === 'reveal' || fase === 'roundEnd') && (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Punteggio */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 12,
            marginBottom: 24,
            border: '1px solid rgba(168,85,247,0.2)',
          }}>
            <div style={{ fontFamily: 'Cinzel, serif' }}>
              <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2 }}>TU</div>
              <div style={{ fontSize: 28, color: '#06d6a0' }}>{punteggio.player}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', letterSpacing: 3, fontSize: 13, color: '#f59e0b' }}>
                ROUND {round} / 5
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                {turno === 'player' ? 'Tocca a te scegliere' : 'Tocca alla CPU'}
              </div>
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2 }}>CPU</div>
              <div style={{ fontSize: 28, color: '#ef4444' }}>{punteggio.cpu}</div>
            </div>
          </div>

          {/* Campo di battaglia: carte in campo */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 24,
            minHeight: 400,
            padding: '24px 0',
          }}>
            {/* Carta CPU */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: 3, opacity: 0.6, fontFamily: 'Cinzel, serif' }}>
                CPU
              </div>
              {carteC ? (
                <div className="card-enter">
                  <CartaWaifu
                    waifu={carteC}
                    rivelata={fase === 'reveal' || fase === 'roundEnd'}
                    evidenziaStat={(fase === 'reveal' || fase === 'roundEnd') ? statScelta : null}
                    perdente={fase === 'roundEnd' && vincitoreRound === 'player'}
                  />
                </div>
              ) : (
                <div style={{
                  width: 240, height: 360,
                  border: '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'Cinzel, serif',
                  letterSpacing: 2,
                }}>
                  IN ATTESA
                </div>
              )}
            </div>

            {/* VS centrale + scelta stat */}
            <div style={{ textAlign: 'center', minWidth: 280 }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: 56,
                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
                letterSpacing: 4,
              }}>
                VS
              </div>

              {/* Scelta stat (solo se è il turno del player e ha già messo una carta) */}
              {fase === 'play' && carteP && carteC && turno === 'player' && !statScelta && (
                <div className="fade-up" style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: '#f59e0b', marginBottom: 12, fontFamily: 'Cinzel, serif' }}>
                    SCEGLI LA STATISTICA
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {STATS.map(s => (
                      <button
                        key={s.key}
                        className="stat-btn"
                        onClick={() => setStatScelta(s.key)}
                      >
                        <span style={{ marginRight: 6, color: '#f59e0b' }}>{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Direzione (più/meno) */}
              {fase === 'play' && statScelta && !direzione && turno === 'player' && (
                <div className="fade-up" style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: '#f59e0b', marginBottom: 12, fontFamily: 'Cinzel, serif' }}>
                    SCEGLI LA DIREZIONE
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="dir-btn" onClick={() => confermaStatPlayer(statScelta, 'piu')}>
                      ▲ PIÙ
                    </button>
                    <button className="dir-btn" onClick={() => confermaStatPlayer(statScelta, 'meno')}>
                      ▼ MENO
                    </button>
                  </div>
                </div>
              )}

              {/* Indicatore della scelta */}
              {(fase === 'reveal' || fase === 'roundEnd') && statScelta && (
                <div className="fade-up" style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                  <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: 2 }}>STATISTICA</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#f59e0b', marginTop: 4 }}>
                    {STATS.find(s => s.key === statScelta).label} {direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}
                  </div>
                </div>
              )}

              {/* CPU sta pensando */}
              {fase === 'play' && carteP && carteC && turno === 'cpu' && !statScelta && (
                <div style={{ marginTop: 16, color: '#a855f7', fontFamily: 'Cinzel, serif', letterSpacing: 2 }} className="pulse">
                  CPU STA SCEGLIENDO...
                </div>
              )}

              {/* Risultato del round */}
              {fase === 'roundEnd' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 20 }}>
                  <div style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: 22,
                    color: vincitoreRound === 'player' ? '#06d6a0' : vincitoreRound === 'cpu' ? '#ef4444' : '#fbbf24',
                    letterSpacing: 3,
                    marginBottom: 12,
                  }}>
                    {vincitoreRound === 'player' && '⚜ HAI VINTO IL ROUND ⚜'}
                    {vincitoreRound === 'cpu' && '✘ ROUND PERSO ✘'}
                    {vincitoreRound === 'pareggio' && '⚐ PAREGGIO ⚐'}
                  </div>
                  <button
                    onClick={prossimoRound}
                    style={{
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                      border: 'none',
                      color: '#000',
                      fontFamily: 'Cinzel, serif',
                      letterSpacing: 2,
                      fontWeight: 600,
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {(punteggio.player >= 3 || punteggio.cpu >= 3 || round >= 5) ? 'FINE PARTITA' : 'PROSSIMO ROUND'}
                  </button>
                </div>
              )}
            </div>

            {/* Carta Player */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: 3, opacity: 0.6, fontFamily: 'Cinzel, serif' }}>
                TU
              </div>
              {carteP ? (
                <div className="card-enter">
                  <CartaWaifu
                    waifu={carteP}
                    rivelata={true}
                    evidenziaStat={statScelta}
                    perdente={fase === 'roundEnd' && vincitoreRound === 'cpu'}
                  />
                </div>
              ) : (
                <div style={{
                  width: 240, height: 360,
                  border: '2px dashed rgba(245,158,11,0.4)',
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(245,158,11,0.6)',
                  fontFamily: 'Cinzel, serif',
                  letterSpacing: 2,
                }} className="pulse">
                  SCEGLI UNA CARTA
                </div>
              )}
            </div>
          </div>

          {/* Mano del giocatore */}
          {fase === 'play' && !carteP && (
            <div style={{ marginTop: 32 }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                letterSpacing: 3,
                fontSize: 13,
                color: '#f59e0b',
                textAlign: 'center',
                marginBottom: 16,
              }}>
                LA TUA MANO ({mazzoP.length} carte)
              </div>
              <div style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
                {mazzoP.map(w => (
                  <div
                    key={w.id}
                    onClick={() => scegliCartaPlayer(w)}
                    style={{
                      cursor: 'pointer',
                      transition: 'transform 0.25s',
                      transform: 'translateY(0)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-12px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <CartaWaifu waifu={w} dimensione="piccola" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== FASE: GAME END ====== */}
      {fase === 'gameEnd' && (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '60px auto' }} className="fade-up">
          <div style={{
            padding: 40,
            background: vincitoreFinale === 'player'
              ? 'linear-gradient(135deg, rgba(6,214,160,0.15), rgba(245,158,11,0.15))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(0,0,0,0.4))',
            border: `2px solid ${vincitoreFinale === 'player' ? '#06d6a0' : '#ef4444'}`,
            borderRadius: 16,
            boxShadow: `0 0 60px ${vincitoreFinale === 'player' ? 'rgba(6,214,160,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <div style={{ fontSize: 80, marginBottom: 16 }}>
              {vincitoreFinale === 'player' ? '👑' : '💔'}
            </div>
            <h2 style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 36,
              letterSpacing: 4,
              margin: 0,
              color: vincitoreFinale === 'player' ? '#06d6a0' : '#ef4444',
            }}>
              {vincitoreFinale === 'player' ? 'VITTORIA' : 'SCONFITTA'}
            </h2>
            <p style={{ marginTop: 16, color: '#d4c5b9', lineHeight: 1.7 }}>
              {vincitoreFinale === 'player' ? (
                <>
                  Hai conquistato il territorio con il punteggio di <strong style={{ color: '#06d6a0' }}>{punteggio.player}-{punteggio.cpu}</strong>.
                  <br />
                  Hai guadagnato <strong style={{ color: '#f59e0b' }}>1 pacchetto</strong> da sbustare!
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>(In quanto vincitore, non hai consumato Energia Tette)</span>
                </>
              ) : (
                <>
                  La CPU ti ha battuto <strong style={{ color: '#ef4444' }}>{punteggio.cpu}-{punteggio.player}</strong>.
                  <br />
                  Hai perso <strong style={{ color: '#f59e0b' }}>1 punto Energia Tette</strong>.
                </>
              )}
            </p>
            <button
              onClick={resetGioco}
              style={{
                marginTop: 24,
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                border: 'none',
                color: '#000',
                fontFamily: 'Cinzel, serif',
                fontSize: 14,
                letterSpacing: 3,
                fontWeight: 600,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              NUOVA BATTAGLIA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
