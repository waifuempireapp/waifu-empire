import React, { useState, useMemo, useEffect } from 'react';

// ============================================================
// IMPERO DELLE WAIFU - Modulo 3: Mappa del Mondo
// ============================================================
// - Mappa SVG con territori cliccabili (continenti semplificati)
// - Sistema di confini e conquista
// - Posizionamento iniziale random
// - Imperi rivali (CPU) con territori colorati
// - Integrazione battaglia (riusa logica Modulo 1)
// - HUD impero + energia 10/10 + ricarica
// ============================================================

// --- DATI GIOCO (in produzione: dal Modulo 5/backend) ---

const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5 },
};

const COLORI_CAPELLI = {
  1:  { hex: '#6b4423' },  2:  { hex: '#1a1a1a' },  3:  { hex: '#f4d35e' },
  4:  { hex: '#c0392b' },  5:  { hex: '#c0c0c0' },  6:  { hex: '#3b82f6' },
  7:  { hex: '#8b5cf6' },  8:  { hex: '#ec4899' },  9:  { hex: 'gradient-bicolor' },
  10: { hex: 'gradient-fantasy' },
};

const STATS = [
  { key: 'tette',          label: 'Tette',         icon: '✦' },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
  { key: 'eta',            label: 'Età',           icon: '⌛' },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
];

// Mazzo di partenza simulato (5 waifu già selezionate dall'utente)
const MAZZO_PARTENZA = [
  { id: 'p1', nome: 'Aria',     rarita: 'leggendario', tette: 4, taglia_piedi: 36, eta: 19,   colore_capelli: 8  },
  { id: 'p2', nome: 'Yumi',     rarita: 'epico',       tette: 6, taglia_piedi: 38, eta: 21,   colore_capelli: 2  },
  { id: 'p3', nome: 'Lyria',    rarita: 'raro',        tette: 2, taglia_piedi: 35, eta: 18,   colore_capelli: 3  },
  { id: 'p4', nome: 'Seraphina',rarita: 'immersivo',   tette: 7, taglia_piedi: 39, eta: 850,  colore_capelli: 10 },
  { id: 'p5', nome: 'Hoshino',  rarita: 'comune',      tette: 3, taglia_piedi: 37, eta: 22,   colore_capelli: 6  },
];

// Imperi rivali (CPU)
const IMPERI_RIVALI = [
  {
    id: 'cpu_crimson', nome: 'Impero Cremisi',
    colore: '#ef4444',
    capitana: { id: 'c1', nome: 'Velvet',   rarita: 'leggendario', tette: 6, taglia_piedi: 38, eta: 28,  colore_capelli: 9 },
    mazzo: [
      { id: 'c1', nome: 'Velvet',   rarita: 'leggendario', tette: 6, taglia_piedi: 38, eta: 28,   colore_capelli: 9  },
      { id: 'c2', nome: 'Mei',      rarita: 'raro',        tette: 3, taglia_piedi: 36, eta: 20,   colore_capelli: 1  },
      { id: 'c3', nome: 'Sakura',   rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 8  },
      { id: 'c4', nome: 'Kira',     rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 23,   colore_capelli: 4  },
      { id: 'c5', nome: 'Aoi',      rarita: 'epico',       tette: 3, taglia_piedi: 35, eta: 25,   colore_capelli: 6  },
    ],
  },
  {
    id: 'cpu_emerald', nome: 'Dominio Smeraldo',
    colore: '#10b981',
    capitana: { id: 'e1', nome: 'Nyx',      rarita: 'immersivo',   tette: 4, taglia_piedi: 39, eta: 1200, colore_capelli: 5 },
    mazzo: [
      { id: 'e1', nome: 'Nyx',      rarita: 'immersivo',   tette: 4, taglia_piedi: 39, eta: 1200, colore_capelli: 5  },
      { id: 'e2', nome: 'Elara',    rarita: 'epico',       tette: 5, taglia_piedi: 37, eta: 24,   colore_capelli: 7  },
      { id: 'e3', nome: 'Luna',     rarita: 'raro',        tette: 5, taglia_piedi: 36, eta: 19,   colore_capelli: 5  },
      { id: 'e4', nome: 'Rin',      rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 2  },
      { id: 'e5', nome: 'Kaede',    rarita: 'raro',        tette: 4, taglia_piedi: 37, eta: 22,   colore_capelli: 7  },
    ],
  },
  {
    id: 'cpu_sapphire', nome: 'Regno di Zaffiro',
    colore: '#3b82f6',
    capitana: { id: 's1', nome: 'Hime', rarita: 'leggendario', tette: 5, taglia_piedi: 36, eta: 26, colore_capelli: 6 },
    mazzo: [
      { id: 's1', nome: 'Hime',     rarita: 'leggendario', tette: 5, taglia_piedi: 36, eta: 26,   colore_capelli: 6  },
      { id: 's2', nome: 'Yuki',     rarita: 'raro',        tette: 3, taglia_piedi: 35, eta: 21,   colore_capelli: 5  },
      { id: 's3', nome: 'Hana',     rarita: 'comune',      tette: 2, taglia_piedi: 34, eta: 18,   colore_capelli: 8  },
      { id: 's4', nome: 'Suzuka',   rarita: 'epico',       tette: 4, taglia_piedi: 37, eta: 23,   colore_capelli: 4  },
      { id: 's5', nome: 'Akane',    rarita: 'comune',      tette: 3, taglia_piedi: 36, eta: 20,   colore_capelli: 4  },
    ],
  },
];

// Definizione territori: id, nome, continente, vertici SVG, lista confinanti
// Mappa stilizzata: 24 territori, 6 continenti
const TERRITORI = [
  // NORD AMERICA (rosa)
  { id: 't_alaska',       nome: 'Alaska',        cont: 'NA', cx: 95,  cy: 130, path: 'M50,80 L150,75 L160,150 L100,180 L40,160 Z',     conf: ['t_canada_w', 't_kamchatka'] },
  { id: 't_canada_w',     nome: 'Canada Ovest',  cont: 'NA', cx: 200, cy: 145, path: 'M150,75 L260,90 L255,180 L160,150 Z',           conf: ['t_alaska', 't_canada_e', 't_usa_w'] },
  { id: 't_canada_e',     nome: 'Canada Est',    cont: 'NA', cx: 305, cy: 145, path: 'M260,90 L370,100 L360,185 L255,180 Z',          conf: ['t_canada_w', 't_usa_e', 't_groenlandia'] },
  { id: 't_groenlandia',  nome: 'Groenlandia',   cont: 'NA', cx: 410, cy: 105, path: 'M370,75 L460,80 L450,140 L370,100 Z',           conf: ['t_canada_e', 't_islanda'] },
  { id: 't_usa_w',        nome: 'USA Ovest',     cont: 'NA', cx: 195, cy: 230, path: 'M160,180 L255,180 L260,275 L165,275 Z',         conf: ['t_canada_w', 't_usa_e', 't_messico'] },
  { id: 't_usa_e',        nome: 'USA Est',       cont: 'NA', cx: 305, cy: 230, path: 'M255,180 L360,185 L355,275 L260,275 Z',         conf: ['t_canada_e', 't_usa_w', 't_messico', 't_caraibi'] },
  { id: 't_messico',      nome: 'Messico',       cont: 'NA', cx: 230, cy: 310, path: 'M165,275 L320,275 L290,345 L195,340 Z',         conf: ['t_usa_w', 't_usa_e', 't_caraibi', 't_venezuela'] },
  // SUD AMERICA (giallo)
  { id: 't_caraibi',      nome: 'Caraibi',       cont: 'SA', cx: 335, cy: 320, path: 'M310,290 L370,290 L375,345 L320,350 Z',         conf: ['t_usa_e', 't_messico', 't_venezuela'] },
  { id: 't_venezuela',    nome: 'Venezuela',     cont: 'SA', cx: 320, cy: 390, path: 'M275,355 L380,360 L370,420 L290,425 Z',         conf: ['t_messico', 't_caraibi', 't_brasile', 't_peru'] },
  { id: 't_peru',         nome: 'Perù',          cont: 'SA', cx: 290, cy: 460, path: 'M270,425 L340,425 L335,510 L275,505 Z',         conf: ['t_venezuela', 't_brasile', 't_argentina'] },
  { id: 't_brasile',      nome: 'Brasile',       cont: 'SA', cx: 360, cy: 460, path: 'M340,425 L420,425 L415,505 L340,505 Z',         conf: ['t_venezuela', 't_peru', 't_argentina', 't_africa_o'] },
  { id: 't_argentina',    nome: 'Argentina',     cont: 'SA', cx: 320, cy: 555, path: 'M275,510 L390,510 L355,610 L295,605 Z',         conf: ['t_peru', 't_brasile'] },
  // EUROPA (blu)
  { id: 't_islanda',      nome: 'Islanda',       cont: 'EU', cx: 480, cy: 165, path: 'M455,140 L515,145 L510,195 L460,190 Z',        conf: ['t_groenlandia', 't_uk', 't_scandinavia'] },
  { id: 't_uk',           nome: 'Regno Unito',   cont: 'EU', cx: 510, cy: 230, path: 'M485,200 L545,205 L540,265 L490,260 Z',         conf: ['t_islanda', 't_scandinavia', 't_europa_o'] },
  { id: 't_scandinavia',  nome: 'Scandinavia',   cont: 'EU', cx: 600, cy: 195, path: 'M555,150 L660,160 L650,235 L555,230 Z',         conf: ['t_islanda', 't_uk', 't_europa_o', 't_russia'] },
  { id: 't_europa_o',     nome: 'Europa Ovest',  cont: 'EU', cx: 575, cy: 280, path: 'M540,235 L640,240 L640,320 L545,315 Z',         conf: ['t_uk', 't_scandinavia', 't_europa_e', 't_africa_n'] },
  { id: 't_europa_e',     nome: 'Europa Est',    cont: 'EU', cx: 670, cy: 285, path: 'M640,240 L735,250 L730,325 L640,320 Z',         conf: ['t_scandinavia', 't_europa_o', 't_russia', 't_medio_oriente', 't_africa_n'] },
  // AFRICA (verde scuro)
  { id: 't_africa_n',     nome: 'Africa Nord',   cont: 'AF', cx: 605, cy: 380, path: 'M550,325 L700,330 L690,425 L555,420 Z',         conf: ['t_europa_o', 't_europa_e', 't_medio_oriente', 't_africa_o', 't_africa_e', 't_brasile'] },
  { id: 't_africa_o',     nome: 'Africa Ovest',  cont: 'AF', cx: 575, cy: 470, path: 'M555,425 L630,425 L625,520 L560,515 Z',         conf: ['t_africa_n', 't_africa_e', 't_brasile'] },
  { id: 't_africa_e',     nome: 'Africa Est',    cont: 'AF', cx: 660, cy: 480, path: 'M635,425 L710,430 L700,535 L630,530 Z',         conf: ['t_africa_n', 't_africa_o', 't_medio_oriente'] },
  // ASIA (rosso scuro)
  { id: 't_russia',       nome: 'Russia',        cont: 'AS', cx: 800, cy: 195, path: 'M735,150 L920,160 L910,260 L740,250 Z',         conf: ['t_scandinavia', 't_europa_e', 't_medio_oriente', 't_cina', 't_kamchatka'] },
  { id: 't_medio_oriente',nome: 'Medio Oriente', cont: 'AS', cx: 745, cy: 360, path: 'M695,290 L800,295 L795,400 L700,395 Z',         conf: ['t_europa_e', 't_russia', 't_africa_n', 't_africa_e', 't_india'] },
  { id: 't_cina',         nome: 'Cina',          cont: 'AS', cx: 870, cy: 320, path: 'M810,260 L935,265 L930,375 L815,370 Z',         conf: ['t_russia', 't_india', 't_kamchatka', 't_giappone'] },
  { id: 't_india',        nome: 'India',         cont: 'AS', cx: 825, cy: 415, path: 'M800,380 L880,385 L870,460 L805,455 Z',         conf: ['t_medio_oriente', 't_cina', 't_indonesia'] },
  { id: 't_giappone',     nome: 'Giappone',      cont: 'AS', cx: 970, cy: 295, path: 'M945,260 L1000,265 L995,335 L950,330 Z',        conf: ['t_cina', 't_kamchatka'] },
  { id: 't_kamchatka',    nome: 'Kamchatka',     cont: 'AS', cx: 945, cy: 175, path: 'M915,130 L995,140 L985,225 L920,220 Z',         conf: ['t_alaska', 't_russia', 't_cina', 't_giappone'] },
  // OCEANIA (arancio)
  { id: 't_indonesia',    nome: 'Indonesia',     cont: 'OC', cx: 900, cy: 470, path: 'M855,455 L945,460 L940,510 L860,505 Z',         conf: ['t_india', 't_australia'] },
  { id: 't_australia',    nome: 'Australia',     cont: 'OC', cx: 935, cy: 555, path: 'M870,510 L1000,515 L995,600 L880,595 Z',        conf: ['t_indonesia'] },
];

const COLORI_CONTINENTI = {
  NA: '#7c3aed', SA: '#fbbf24', EU: '#0ea5e9',
  AF: '#16a34a', AS: '#dc2626', OC: '#f97316',
};

// ============================================================
// LOGICA DI BATTAGLIA (semplificata e inline)
// ============================================================
function BattagliaModale({ giocatore, mazzoG, impero, onFine }) {
  const [fase, setFase] = useState('intro');
  const [turno, setTurno] = useState(null);
  const [round, setRound] = useState(1);
  const [punteggio, setPunteggio] = useState({ p: 0, c: 0 });
  const [mazzoP, setMazzoP] = useState([...mazzoG]);
  const [mazzoC, setMazzoC] = useState([...impero.mazzo]);
  const [carteP, setCarteP] = useState(null);
  const [carteC, setCarteC] = useState(null);
  const [statScelta, setStatScelta] = useState(null);
  const [direzione, setDirezione] = useState(null);
  const [vincitoreRound, setVincitoreRound] = useState(null);

  const start = () => {
    setFase('coin');
    setTimeout(() => {
      const r = Math.random() < 0.5 ? 'p' : 'c';
      setTurno(r);
      setFase('play');
    }, 1500);
  };

  const scegliCarta = (c) => {
    if (carteP) return;
    setCarteP(c);
    const cpuPick = mazzoC[Math.floor(Math.random() * mazzoC.length)];
    setCarteC(cpuPick);
  };

  useEffect(() => {
    if (fase === 'play' && carteP && carteC && !statScelta && turno === 'c') {
      setTimeout(() => {
        const stat = STATS[Math.floor(Math.random() * STATS.length)].key;
        const dir = carteC[stat] >= carteP[stat] ? 'piu' : 'meno';
        setStatScelta(stat);
        setDirezione(dir);
        setTimeout(() => risolvi(stat, dir), 1000);
      }, 1200);
    }
  }, [fase, carteP, carteC, turno, statScelta]);

  const confermaPlayer = (stat, dir) => {
    setStatScelta(stat); setDirezione(dir);
    setTimeout(() => risolvi(stat, dir), 700);
  };

  const risolvi = (stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      const vp = carteP[stat], vc = carteC[stat];
      let v = vp === vc ? 'pareggio' : (dir === 'piu' ? (vp > vc ? 'p' : 'c') : (vp < vc ? 'p' : 'c'));
      setVincitoreRound(v);
      const np = { ...punteggio };
      if (v === 'p') np.p++; if (v === 'c') np.c++;
      setPunteggio(np);
      setFase('roundEnd');
    }, 1200);
  };

  const prossimo = () => {
    setMazzoP(mazzoP.filter(w => w.id !== carteP.id));
    setMazzoC(mazzoC.filter(w => w.id !== carteC.id));
    if (punteggio.p >= 3 || punteggio.c >= 3 || round >= 5) {
      onFine(punteggio.p > punteggio.c);
      return;
    }
    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    setRound(r => r + 1);
    setTurno(t => t === 'p' ? 'c' : 'p');
    setFase('play');
  };

  return (
    <div style={modaleOverlay}>
      <div style={{ ...modaleBox, maxWidth: 1100, padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 3, color: impero.colore }}>
            ⚔ BATTAGLIA CONTRO {impero.nome.toUpperCase()} ⚔
          </div>
        </div>

        {fase === 'intro' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#d4c5b9', maxWidth: 500, margin: '0 auto 20px' }}>
              Sfida {impero.nome} al meglio di 5 round per conquistare il territorio.
              Se vinci, ottieni il territorio e <strong style={{ color: '#f59e0b' }}>1 pacchetto</strong>.
              Se perdi, perdi <strong>1 punto Energia Tette</strong>.
            </p>
            <button onClick={start} style={btnPrimario}>LANCIA LA MONETA</button>
            <button onClick={() => onFine(null)} style={{ ...btnSecondario, marginLeft: 8 }}>RITIRATI</button>
          </div>
        )}

        {fase === 'coin' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{
              width: 100, height: 100, margin: '0 auto',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #fbbf24, #b45309)',
              animation: 'spin 1.4s ease-out',
              boxShadow: '0 0 40px rgba(245,158,11,0.5)',
            }} />
            <div style={{ marginTop: 16, fontFamily: 'Cinzel, serif', letterSpacing: 3, color: '#f59e0b' }}>
              LANCIO IN CORSO...
            </div>
          </div>
        )}

        {(fase === 'play' || fase === 'reveal' || fase === 'roundEnd') && (
          <>
            <div style={hudBattaglia}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 10, opacity: 0.6 }}>TU</div>
                <div style={{ fontSize: 24, color: '#06d6a0' }}>{punteggio.p}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: 12, letterSpacing: 2 }}>ROUND {round}/5</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                  {turno === 'p' ? 'Tocca a te' : 'Tocca alla CPU'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{impero.nome}</div>
                <div style={{ fontSize: 24, color: impero.colore }}>{punteggio.c}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
              <CartaBattaglia waifu={carteC} rivelata={fase === 'reveal' || fase === 'roundEnd'} stat={statScelta} placeholder="CPU IN ATTESA" />
              <div style={{ textAlign: 'center', minWidth: 240 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 40, fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VS</div>

                {fase === 'play' && carteP && carteC && turno === 'p' && !statScelta && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', letterSpacing: 2, marginBottom: 8, fontFamily: 'Cinzel, serif' }}>SCEGLI STAT</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      {STATS.map(s => (
                        <button key={s.key} onClick={() => setStatScelta(s.key)} style={btnStat}>
                          <span style={{ color: '#f59e0b' }}>{s.icon}</span> {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {fase === 'play' && statScelta && !direzione && turno === 'p' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', letterSpacing: 2, marginBottom: 8, fontFamily: 'Cinzel, serif' }}>DIREZIONE</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => confermaPlayer(statScelta, 'piu')} style={btnDir}>▲ PIÙ</button>
                      <button onClick={() => confermaPlayer(statScelta, 'meno')} style={btnDir}>▼ MENO</button>
                    </div>
                  </div>
                )}
                {fase === 'play' && carteP && carteC && turno === 'c' && !statScelta && (
                  <div style={{ marginTop: 12, color: impero.colore, fontFamily: 'Cinzel, serif', letterSpacing: 2, fontSize: 12 }}>
                    CPU STA SCEGLIENDO...
                  </div>
                )}
                {(fase === 'reveal' || fase === 'roundEnd') && statScelta && (
                  <div style={{ marginTop: 12, padding: 8, background: 'rgba(245,158,11,0.12)', borderRadius: 8, fontSize: 11 }}>
                    <span style={{ color: '#f59e0b', fontFamily: 'Cinzel, serif', letterSpacing: 2 }}>
                      {STATS.find(s => s.key === statScelta).label} {direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}
                    </span>
                  </div>
                )}
                {fase === 'roundEnd' && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      fontFamily: 'Cinzel, serif', fontSize: 18, letterSpacing: 2,
                      color: vincitoreRound === 'p' ? '#06d6a0' : vincitoreRound === 'c' ? impero.colore : '#fbbf24',
                      marginBottom: 12,
                    }}>
                      {vincitoreRound === 'p' && '⚜ ROUND TUO ⚜'}
                      {vincitoreRound === 'c' && '✘ ROUND PERSO'}
                      {vincitoreRound === 'pareggio' && '⚐ PAREGGIO'}
                    </div>
                    <button onClick={prossimo} style={btnPrimario}>
                      {(punteggio.p >= 3 || punteggio.c >= 3 || round >= 5) ? 'FINE' : 'AVANTI'}
                    </button>
                  </div>
                )}
              </div>
              <CartaBattaglia waifu={carteP} rivelata={true} stat={statScelta} placeholder="SCEGLI UNA CARTA" />
            </div>

            {fase === 'play' && !carteP && (
              <div style={{ marginTop: 20 }}>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#f59e0b', letterSpacing: 2, marginBottom: 10, fontFamily: 'Cinzel, serif' }}>
                  LA TUA MANO ({mazzoP.length})
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {mazzoP.map(w => (
                    <div key={w.id} onClick={() => scegliCarta(w)} style={{ cursor: 'pointer', transition: 'transform 0.25s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <CartaBattaglia waifu={w} rivelata={true} mini />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CartaBattaglia({ waifu, rivelata, stat, mini, placeholder }) {
  const W = mini ? 110 : 180;
  const H = mini ? 165 : 270;
  if (!waifu) {
    return (
      <div style={{
        width: W, height: H, borderRadius: 10,
        border: '2px dashed rgba(245,158,11,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(245,158,11,0.5)', fontFamily: 'Cinzel, serif',
        fontSize: 10, letterSpacing: 2, textAlign: 'center', padding: 8,
      }}>{placeholder}</div>
    );
  }
  if (!rivelata) {
    return (
      <div style={{
        width: W, height: H, borderRadius: 10,
        background: 'linear-gradient(135deg, #1a0a2e, #16213e)',
        border: '2px solid rgba(168,85,247,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, color: 'rgba(168,85,247,0.7)',
      }}>♛</div>
    );
  }
  const rar = RARITA[waifu.rarita];
  const cap = COLORI_CAPELLI[waifu.colore_capelli];
  let hairFill = cap.hex;
  if (cap.hex === 'gradient-bicolor') hairFill = 'url(#bg-bi)';
  if (cap.hex === 'gradient-fantasy') hairFill = 'url(#bg-fa)';
  return (
    <div style={{
      width: W, height: H, borderRadius: 10,
      background: 'linear-gradient(160deg, #0f0a1e, #1a0f2e)',
      border: `2px solid ${rar.colore}`,
      boxShadow: `0 0 12px ${rar.glow}`,
      overflow: 'hidden',
      fontSize: mini ? 9 : 11,
    }}>
      <div style={{ padding: '4px 8px', borderBottom: `1px solid ${rar.colore}40`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: mini ? 10 : 13 }}>{waifu.nome}</span>
        <span style={{ color: rar.colore, fontSize: mini ? 8 : 10 }}>{'★'.repeat(rar.stelle)}</span>
      </div>
      <svg viewBox="0 0 100 100" width="100%" height={mini ? 55 : 90} preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="bg-bi" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ec4899" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
          <linearGradient id="bg-fa"><stop offset="0%" stopColor="#06d6a0" /><stop offset="100%" stopColor="#ffafcc" /></linearGradient>
        </defs>
        <circle cx="50" cy="35" r="18" fill={hairFill} opacity="0.85" />
        <ellipse cx="50" cy="38" rx="11" ry="13" fill="#f5d5b5" opacity="0.9" />
        <g transform="translate(50, 65)">
          {[...Array(waifu.tette)].map((_, i) => (
            <circle key={i} cx={(i - waifu.tette / 2 + 0.5) * 3} cy={0} r={1.2} fill={rar.colore} opacity={0.9} />
          ))}
        </g>
      </svg>
      <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {STATS.map(s => {
          const isHi = stat === s.key;
          return (
            <div key={s.key} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '2px 4px', borderRadius: 4,
              background: isHi ? `${rar.colore}30` : 'transparent',
              fontSize: mini ? 8 : 10,
            }}>
              <span style={{ opacity: 0.7 }}>{s.icon} {s.label}</span>
              <span style={{ fontWeight: 600, color: isHi ? rar.colore : '#f5e6d3' }}>{waifu[s.key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPALE: MAPPA DEL MONDO
// ============================================================
export default function MappaImpero() {
  // Onboarding
  const [onboarding, setOnboarding] = useState(true);
  const [nomeImpero, setNomeImpero] = useState('');
  const [coloreImpero] = useState('#f59e0b'); // utente sceglie nel Modulo 5

  // Stato della partita
  const [territori, setTerritori] = useState({});  // {id: 'player' | 'cpu_crimson' | 'cpu_emerald' | 'cpu_sapphire' | 'neutro'}
  const [territorioSelezionato, setTerritorioSelezionato] = useState(null);
  const [territorioInGuerra, setTerritorioInGuerra] = useState(null);
  const [iCapitano, setICapitano] = useState(MAZZO_PARTENZA[0]);

  // Risorse
  const [energia, setEnergia] = useState(10);
  const [pacchetti, setPacchetti] = useState(0);
  const [notifica, setNotifica] = useState(null);

  const mostraNotifica = (testo, colore = '#06d6a0') => {
    setNotifica({ testo, colore });
    setTimeout(() => setNotifica(null), 2500);
  };

  // Inizializza la mappa: posizionamento random
  const iniziaPartita = () => {
    if (!nomeImpero.trim()) {
      mostraNotifica('Inserisci un nome per il tuo impero', '#ef4444');
      return;
    }
    const mappa = {};
    // Player: 1 territorio random
    const idxPlayer = Math.floor(Math.random() * TERRITORI.length);
    mappa[TERRITORI[idxPlayer].id] = 'player';
    // CPU: ognuna parte con 2 territori random non adiacenti al player
    const restanti = TERRITORI.filter((_, i) => i !== idxPlayer);
    const shuffled = [...restanti].sort(() => Math.random() - 0.5);
    let i = 0;
    IMPERI_RIVALI.forEach(imp => {
      for (let j = 0; j < 2; j++) {
        if (i < shuffled.length) {
          mappa[shuffled[i].id] = imp.id;
          i++;
        }
      }
    });
    // Resto: neutro
    TERRITORI.forEach(t => {
      if (!mappa[t.id]) mappa[t.id] = 'neutro';
    });
    setTerritori(mappa);
    setOnboarding(false);
    mostraNotifica(`${nomeImpero} è stato fondato!`, '#f59e0b');
  };

  // Click su un territorio
  const onClickTerritorio = (t) => {
    if (territori[t.id] === 'player') {
      setTerritorioSelezionato(t.id);
      return;
    }
    // È adiacente a un mio territorio?
    const miei = Object.entries(territori).filter(([_, v]) => v === 'player').map(([k]) => k);
    const adiacenteMio = t.conf.some(c => miei.includes(c));
    if (!adiacenteMio) {
      mostraNotifica('Devi avere un territorio confinante per attaccare', '#ef4444');
      return;
    }
    setTerritorioSelezionato(t.id);
  };

  const dichiaraGuerra = (t) => {
    if (energia <= 0) {
      mostraNotifica('Non hai abbastanza energia', '#ef4444');
      return;
    }
    setTerritorioInGuerra(t);
    setTerritorioSelezionato(null);
  };

  const onFineBattaglia = (vinto) => {
    const t = territorioInGuerra;
    setTerritorioInGuerra(null);
    if (vinto === null) {
      // Ritirata
      mostraNotifica('Ti sei ritirato', '#fbbf24');
      return;
    }
    if (vinto) {
      setTerritori(prev => ({ ...prev, [t.id]: 'player' }));
      setPacchetti(p => Math.min(2, p + 1));
      mostraNotifica(`${t.nome} conquistato! +1 pacchetto`, '#06d6a0');
    } else {
      setEnergia(e => Math.max(0, e - 1));
      mostraNotifica(`Sconfitta a ${t.nome}. -1 energia`, '#ef4444');
    }
  };

  // Statistiche
  const statiTerritori = useMemo(() => {
    const counts = { player: 0, neutro: 0 };
    IMPERI_RIVALI.forEach(imp => counts[imp.id] = 0);
    Object.values(territori).forEach(v => {
      if (counts[v] !== undefined) counts[v]++;
    });
    return counts;
  }, [territori]);

  const territoriSelezionatoData = territorioSelezionato ? TERRITORI.find(t => t.id === territorioSelezionato) : null;
  const proprietarioSelezionato = territorioSelezionato ? territori[territorioSelezionato] : null;
  const imperoNemico = proprietarioSelezionato && proprietarioSelezionato.startsWith('cpu_')
    ? IMPERI_RIVALI.find(i => i.id === proprietarioSelezionato) : null;

  // Color helper
  const coloreTerritorio = (id) => {
    const stato = territori[id];
    if (!stato || stato === 'neutro') return null;
    if (stato === 'player') return coloreImpero;
    const imp = IMPERI_RIVALI.find(i => i.id === stato);
    return imp ? imp.colore : null;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'radial-gradient(ellipse at top, #2a0a3e 0%, #0a0515 50%, #000 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f5e6d3', padding: 16,
      position: 'relative',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { from { transform: rotateY(0); } to { transform: rotateY(2160deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes pulseTerritory { 0%, 100% { stroke-width: 2; } 50% { stroke-width: 4; } }
        .territory-clickable:hover { filter: brightness(1.3) drop-shadow(0 0 8px currentColor); cursor: pointer; }
        .territory-selected { animation: pulseTerritory 1.5s ease-in-out infinite; }
      `}</style>

      {/* Notifica */}
      {notifica && (
        <div style={{
          position: 'fixed', top: 16, left: '50%',
          background: 'rgba(0,0,0,0.92)',
          border: `1px solid ${notifica.colore}`,
          color: notifica.colore, padding: '10px 24px', borderRadius: 24,
          fontFamily: 'Cinzel, serif', letterSpacing: 2, fontSize: 12,
          zIndex: 200, animation: 'slideDown 0.3s ease-out',
          boxShadow: `0 0 25px ${notifica.colore}50`,
        }}>
          ✦ {notifica.testo} ✦
        </div>
      )}

      {/* Onboarding */}
      {onboarding && (
        <div style={modaleOverlay}>
          <div style={{ ...modaleBox, maxWidth: 520, padding: 32 }}>
            <h2 style={{
              fontFamily: 'Cinzel, serif', textAlign: 'center', margin: 0,
              fontSize: 28, letterSpacing: 4,
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              FONDA IL TUO IMPERO
            </h2>
            <p style={{ color: '#d4c5b9', textAlign: 'center', lineHeight: 1.7, marginTop: 16 }}>
              Scegli un nome per il tuo impero. Verrai posizionato in un territorio casuale del mondo.
              <br />Il tuo obiettivo: conquistare il pianeta una waifu alla volta.
            </p>
            <div style={{ marginTop: 24 }}>
              <input
                value={nomeImpero}
                onChange={e => setNomeImpero(e.target.value)}
                placeholder="Es. Impero del Sol Levante"
                maxLength={30}
                style={{
                  width: '100%', padding: 12,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 8, color: '#f5e6d3',
                  fontFamily: 'Cinzel, serif', fontSize: 16,
                  letterSpacing: 1, textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6, textAlign: 'center' }}>
              <strong>Capitano:</strong> {iCapitano.nome} ({RARITA[iCapitano.rarita].nome})
              <br />
              <span style={{ fontSize: 10 }}>(In futuro sceglierai capitano e mazzo dalla collezione)</span>
            </div>
            <button onClick={iniziaPartita} style={{ ...btnPrimario, width: '100%', marginTop: 20, padding: 14 }}>
              FONDA L'IMPERO
            </button>
          </div>
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
          ⚔ CONQUISTA DEL MONDO ⚔
        </div>
      </div>

      {/* HUD del giocatore */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 12, padding: '10px 16px',
        marginBottom: 12, gap: 12, flexWrap: 'wrap',
      }}>
        {/* Stemma + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: `linear-gradient(135deg, ${coloreImpero}, ${coloreImpero}80)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${coloreImpero}`,
            boxShadow: `0 0 12px ${coloreImpero}80`,
          }}>
            <svg viewBox="0 0 40 40" width="32" height="32">
              <circle cx="20" cy="14" r="7" fill={COLORI_CAPELLI[iCapitano.colore_capelli].hex === 'gradient-bicolor' || COLORI_CAPELLI[iCapitano.colore_capelli].hex === 'gradient-fantasy' ? '#ec4899' : COLORI_CAPELLI[iCapitano.colore_capelli].hex} />
              <ellipse cx="20" cy="16" rx="4" ry="5" fill="#f5d5b5" />
              <rect x="14" y="22" width="12" height="14" rx="2" fill="#f5d5b5" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 14, color: coloreImpero, letterSpacing: 1 }}>
              {nomeImpero || 'Impero'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>
              Capitano: <strong style={{ color: RARITA[iCapitano.rarita].colore }}>{iCapitano.nome}</strong>
            </div>
          </div>
        </div>

        {/* Risorse */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1 }}>TERRITORI</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: coloreImpero }}>
              {statiTerritori.player}/{TERRITORI.length}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1 }}>ENERGIA</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#f59e0b' }}>
              ✦ {energia}/10
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1 }}>PACCHETTI</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#ec4899' }}>
              🎁 {pacchetti}/2
            </div>
          </div>
        </div>
      </div>

      {/* Layout: mappa + pannello info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 1280, margin: '0 auto' }}>
        {/* MAPPA */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(15,10,30,0.5), rgba(10,5,21,0.7))',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 12, padding: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Background ocean */}
          <svg viewBox="0 0 1050 650" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <radialGradient id="ocean">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#0a0515" />
              </radialGradient>
              <pattern id="waves" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M0,20 Q10,15 20,20 T40,20" fill="none" stroke="rgba(168,85,247,0.1)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="1050" height="650" fill="url(#ocean)" />
            <rect width="1050" height="650" fill="url(#waves)" />

            {/* Indicatori continenti */}
            {Object.entries(COLORI_CONTINENTI).map(([cont, col]) => {
              const tt = TERRITORI.filter(t => t.cont === cont);
              if (!tt.length) return null;
              const minX = Math.min(...tt.map(t => t.cx));
              const maxX = Math.max(...tt.map(t => t.cx));
              const minY = Math.min(...tt.map(t => t.cy));
              return (
                <text key={cont} x={(minX + maxX) / 2} y={minY - 30}
                  textAnchor="middle" fontSize="11"
                  fill={col} opacity="0.5"
                  fontFamily="Cinzel, serif" letterSpacing="3">
                  {cont === 'NA' ? 'NORD AMERICA' : cont === 'SA' ? 'SUD AMERICA' :
                    cont === 'EU' ? 'EUROPA' : cont === 'AF' ? 'AFRICA' :
                      cont === 'AS' ? 'ASIA' : 'OCEANIA'}
                </text>
              );
            })}

            {/* Territori */}
            {TERRITORI.map(t => {
              const stato = territori[t.id];
              const colTerr = coloreTerritorio(t.id);
              const colCont = COLORI_CONTINENTI[t.cont];
              const isSel = territorioSelezionato === t.id;
              const fill = colTerr || colCont + '40';
              const stroke = colTerr || colCont + '99';
              return (
                <g key={t.id}>
                  <path
                    d={t.path}
                    fill={fill}
                    stroke={isSel ? '#f59e0b' : stroke}
                    strokeWidth={isSel ? 3 : 1.5}
                    className={`territory-clickable ${isSel ? 'territory-selected' : ''}`}
                    onClick={() => onClickTerritorio(t)}
                    style={{ transition: 'all 0.25s' }}
                  />
                  <text x={t.cx} y={t.cy} textAnchor="middle"
                    fontSize="10" fill="#f5e6d3"
                    fontFamily="Cinzel, serif" letterSpacing="1"
                    style={{ pointerEvents: 'none', textShadow: '0 0 4px black' }}>
                    {t.nome}
                  </text>
                  {/* Bandierina se conquistato */}
                  {colTerr && (
                    <circle cx={t.cx + 25} cy={t.cy - 14} r="4" fill={colTerr}
                      stroke="rgba(0,0,0,0.5)" strokeWidth="1"
                      style={{ pointerEvents: 'none' }} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legenda */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center',
            marginTop: 8, flexWrap: 'wrap',
            fontSize: 10, fontFamily: 'Cinzel, serif', letterSpacing: 1,
          }}>
            <LegendaItem colore={coloreImpero} label={nomeImpero || 'Tu'} />
            {IMPERI_RIVALI.map(imp => (
              <LegendaItem key={imp.id} colore={imp.colore} label={imp.nome} />
            ))}
            <LegendaItem colore="#666" label="Neutrale" />
          </div>
        </div>

        {/* Pannello territorio selezionato */}
        {territoriSelezionatoData && (
          <div style={{
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            border: `2px solid ${proprietarioSelezionato === 'player' ? coloreImpero : (imperoNemico?.colore || '#666')}`,
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, letterSpacing: 2, color: '#f5e6d3' }}>
                  {territoriSelezionatoData.nome}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, letterSpacing: 1 }}>
                  Continente: <span style={{ color: COLORI_CONTINENTI[territoriSelezionatoData.cont] }}>
                    {{ NA: 'Nord America', SA: 'Sud America', EU: 'Europa', AF: 'Africa', AS: 'Asia', OC: 'Oceania' }[territoriSelezionatoData.cont]}
                  </span>
                </div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  Stato: <strong style={{ color: proprietarioSelezionato === 'player' ? coloreImpero : (imperoNemico?.colore || '#999') }}>
                    {proprietarioSelezionato === 'player' ? `Tuo (${nomeImpero})` :
                      imperoNemico ? `Sotto controllo di ${imperoNemico.nome}` : 'Neutrale'}
                  </strong>
                </div>
                {imperoNemico && (
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                    Capitana nemica: <strong style={{ color: RARITA[imperoNemico.capitana.rarita].colore }}>
                      {imperoNemico.capitana.nome} ({RARITA[imperoNemico.capitana.rarita].nome})
                    </strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {proprietarioSelezionato !== 'player' && (
                  <button
                    onClick={() => dichiaraGuerra(territoriSelezionatoData)}
                    disabled={energia <= 0}
                    style={{
                      ...btnPrimario,
                      opacity: energia <= 0 ? 0.4 : 1,
                      cursor: energia <= 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ⚔ DICHIARA GUERRA
                  </button>
                )}
                <button onClick={() => setTerritorioSelezionato(null)} style={btnSecondario}>
                  CHIUDI
                </button>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 10, opacity: 0.6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
              Confina con: {territoriSelezionatoData.conf.map(id => TERRITORI.find(t => t.id === id)?.nome).filter(Boolean).join(' · ')}
            </div>
          </div>
        )}
      </div>

      {/* Battaglia */}
      {territorioInGuerra && (
        <BattagliaModale
          giocatore={{ nome: nomeImpero, colore: coloreImpero }}
          mazzoG={MAZZO_PARTENZA}
          impero={IMPERI_RIVALI.find(i => i.id === territori[territorioInGuerra.id]) ||
                  IMPERI_RIVALI[0] /* fallback per neutri */}
          onFine={onFineBattaglia}
        />
      )}

      {/* Vittoria globale */}
      {statiTerritori.player === TERRITORI.length && !onboarding && (
        <div style={modaleOverlay}>
          <div style={{ ...modaleBox, maxWidth: 500, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 80 }}>👑</div>
            <h2 style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: 32, letterSpacing: 4, margin: '12px 0' }}>
              IMPERATORE
            </h2>
            <p style={{ color: '#d4c5b9', lineHeight: 1.7 }}>
              Hai conquistato il mondo, fondatore di <strong style={{ color: coloreImpero }}>{nomeImpero}</strong>.
              <br />Il tuo impero domina ogni continente.
            </p>
          </div>
        </div>
      )}

      {/* Pannello debug */}
      <div style={{
        position: 'fixed', bottom: 12, right: 12,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(168,85,247,0.4)',
        borderRadius: 8, padding: 8,
        fontSize: 10, fontFamily: 'monospace',
        display: 'flex', flexDirection: 'column', gap: 4,
        zIndex: 50,
      }}>
        <div style={{ fontSize: 9, opacity: 0.6 }}>DEBUG</div>
        <button onClick={() => setEnergia(10)} style={{ ...btnSecondario, padding: '3px 8px', fontSize: 10 }}>
          Energia max
        </button>
        <button onClick={() => {
          // Conquista istantanea del territorio selezionato (test)
          if (territorioSelezionato && territori[territorioSelezionato] !== 'player') {
            setTerritori(prev => ({ ...prev, [territorioSelezionato]: 'player' }));
            mostraNotifica('Territorio conquistato (debug)');
          }
        }} style={{ ...btnSecondario, padding: '3px 8px', fontSize: 10 }}>
          Conquista test
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTI E STILI HELPER
// ============================================================
function LegendaItem({ colore, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 10, background: colore, borderRadius: 2, display: 'inline-block', boxShadow: `0 0 6px ${colore}80` }} />
      <span style={{ opacity: 0.8 }}>{label}</span>
    </span>
  );
}

const modaleOverlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
  zIndex: 100, overflowY: 'auto', padding: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modaleBox = {
  width: '100%', margin: '0 auto',
  background: 'linear-gradient(160deg, #0f0a1e, #1a0f2e)',
  border: '2px solid rgba(245,158,11,0.5)',
  borderRadius: 16,
  boxShadow: '0 0 60px rgba(245,158,11,0.3)',
};

const btnPrimario = {
  padding: '10px 24px',
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000', fontWeight: 600,
  fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 2,
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

const btnStat = {
  padding: '6px 10px',
  background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.15))',
  border: '1px solid rgba(245,158,11,0.4)',
  color: '#f5e6d3', borderRadius: 6,
  fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1,
  cursor: 'pointer',
};

const btnDir = {
  padding: '8px 16px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.5)',
  color: '#f5e6d3',
  fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 2,
  borderRadius: 8, cursor: 'pointer',
};

const hudBattaglia = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 16px',
  background: 'rgba(0,0,0,0.4)',
  borderRadius: 10,
  border: '1px solid rgba(245,158,11,0.2)',
};
