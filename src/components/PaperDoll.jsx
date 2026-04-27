// src/components/PaperDoll.jsx
'use client';
import React from 'react';
import { RARITA, COLORI_CAPELLI } from '@/lib/constants';

export default function PaperDoll({ waifu, equip, datiCollezione, dimensione = 240, sfondoRarita = false, outfitCatalogo = [], poseCatalogo = [] }) {
  if (!waifu) return null;
  const rar = RARITA[waifu.rarita] || RARITA.comune;
  const cap = COLORI_CAPELLI[waifu.colore_capelli] || COLORI_CAPELLI[1];
  const tetteEff = Math.min(7, waifu.tette + (datiCollezione?.stat_bonus?.tette || 0));

  const oFaccia = equip?.faccia ? outfitCatalogo.find(o => o.id === equip.faccia) : null;
  const oPetto = equip?.petto ? outfitCatalogo.find(o => o.id === equip.petto) : null;
  const oGambe = equip?.gambe ? outfitCatalogo.find(o => o.id === equip.gambe) : null;
  const oPiedi = equip?.piedi ? outfitCatalogo.find(o => o.id === equip.piedi) : null;
  const posa = equip?.posa ? poseCatalogo.find(p => p.id === equip.posa) : null;

  const t = posa?.transform || { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(0)' };
  const uid = `${(waifu.id || waifu.nome || 'x').replace(/[^a-z0-9]/gi, '')}-${dimensione}`;
  const W = dimensione;
  const H = Math.round(dimensione * 1.5);

  if (waifu.asset_paperdoll) {
    return (
      <div style={{ width: W, height: H, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={waifu.asset_paperdoll} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  const skinBase = '#f5d5b5';
  const skinShadow = '#d4a98a';
  const skinHighlight = '#fce5cb';

  return (
    <svg viewBox="0 0 200 320" width={W} height={H} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`hair-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={lightenColor(cap.solid, 25)} />
          <stop offset="50%" stopColor={cap.solid} />
          <stop offset="100%" stopColor={darkenColor(cap.solid, 30)} />
        </linearGradient>
        <linearGradient id={`bicolor-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id={`fantasy-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06d6a0" />
          <stop offset="33%" stopColor="#c0c0ff" />
          <stop offset="66%" stopColor="#ffafcc" />
          <stop offset="100%" stopColor="#ffd700" />
        </linearGradient>
        <linearGradient id={`skin-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="50%" stopColor={skinBase} />
          <stop offset="100%" stopColor={skinShadow} />
        </linearGradient>
        <radialGradient id={`aura-${uid}`}>
          <stop offset="0%" stopColor={rar.colore} stopOpacity="0.6" />
          <stop offset="50%" stopColor={rar.colore} stopOpacity="0.2" />
          <stop offset="100%" stopColor={rar.colore} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="35%">
          <stop offset="0%" stopColor={rar.colore} stopOpacity="0.45" />
          <stop offset="60%" stopColor="#1a0f2e" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0a0515" stopOpacity="1" />
        </radialGradient>
        <pattern id={`pattern-${uid}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10,0 L10,20 M0,10 L20,10" stroke={rar.colore} strokeWidth="0.3" opacity="0.15" />
          <circle cx="10" cy="10" r="0.8" fill={rar.colore} opacity="0.3" />
        </pattern>
        <radialGradient id={`vignette-${uid}`} cx="50%" cy="50%" r="60%">
          <stop offset="60%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.6" />
        </radialGradient>
        <filter id={`drop-${uid}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      {sfondoRarita && (
        <>
          <rect width="200" height="320" fill={`url(#bg-${uid})`} />
          <rect width="200" height="320" fill={`url(#pattern-${uid})`} />
          <ellipse cx="100" cy="285" rx="55" ry="10" fill={rar.colore} opacity="0.3" />
          <ellipse cx="100" cy="285" rx="42" ry="7" fill="none" stroke={rar.colore} strokeWidth="1" opacity="0.7" />
          <ellipse cx="100" cy="285" rx="35" ry="6" fill="none" stroke={rar.colore} strokeWidth="0.5" opacity="0.5" strokeDasharray="3,2" />
          {[...Array(8)].map((_, i) => (
            <circle key={i}
              cx={100 + Math.cos(i * Math.PI / 4) * 60}
              cy={150 + Math.sin(i * Math.PI / 3) * 80}
              r={1 + (i % 3) * 0.5}
              fill={rar.colore} opacity={0.4 + (i % 3) * 0.15} />
          ))}
        </>
      )}

      <ellipse cx="100" cy="160" rx="75" ry="135" fill={`url(#aura-${uid})`} />

      {/* CAPELLI POSTERIORI */}
      <g filter={`url(#drop-${uid})`}>
        <path d="M 60,55 Q 45,130 55,210 Q 60,225 70,215 Q 78,160 85,80 Z" fill={resolveCap(cap, uid)} opacity="0.92" />
        <path d="M 140,55 Q 155,130 145,210 Q 140,225 130,215 Q 122,160 115,80 Z" fill={resolveCap(cap, uid)} opacity="0.92" />
        <path d="M 65,70 Q 58,130 62,200" stroke={lightenColor(cap.solid, 40)} strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M 135,70 Q 142,130 138,200" stroke={lightenColor(cap.solid, 40)} strokeWidth="1.5" fill="none" opacity="0.5" />
      </g>

      {/* Braccio sinistro */}
      <g transform={t.braccio_sx} filter={`url(#drop-${uid})`}>
        <path d="M 64,108 Q 62,135 65,165 Q 70,168 73,160 Q 75,135 76,108 Z" fill={`url(#skin-${uid})`} />
        <circle cx="69" cy="165" r="6" fill={`url(#skin-${uid})`} />
      </g>

      {/* TORSO con proporzioni più femminili */}
      <g filter={`url(#drop-${uid})`}>
        <path d="M 92,80 L 92,98 Q 100,100 108,98 L 108,80 Z" fill={`url(#skin-${uid})`} />
        <path d="M 78,98 Q 72,103 70,115 L 73,140 Q 75,155 80,165 L 78,180 Q 100,185 122,180 L 120,165 Q 125,155 127,140 L 130,115 Q 128,103 122,98 Q 115,96 108,98 L 92,98 Q 85,96 78,98 Z" fill={`url(#skin-${uid})`} />
        <ellipse cx={88 + (tetteEff - 3) * 1} cy={130} rx={5 + tetteEff * 0.8} ry={6 + tetteEff * 0.8} fill={skinShadow} opacity="0.25" />
        <ellipse cx={112 - (tetteEff - 3) * 1} cy={130} rx={5 + tetteEff * 0.8} ry={6 + tetteEff * 0.8} fill={skinShadow} opacity="0.25" />
        <path d="M 78,180 Q 100,185 122,180 L 122,195 Q 100,200 78,195 Z" fill={`url(#skin-${uid})`} />
        <path d="M 80,182 Q 100,187 120,182" stroke={skinShadow} strokeWidth="0.6" fill="none" opacity="0.4" />
        <path d="M 78,195 Q 75,210 76,225 L 80,230 L 100,232 L 120,230 L 124,225 Q 125,210 122,195 Z" fill={`url(#skin-${uid})`} />
        <path d="M 80,230 Q 78,260 80,285 L 95,287 Q 98,260 96,232 Z" fill={`url(#skin-${uid})`} />
        <path d="M 120,230 Q 122,260 120,285 L 105,287 Q 102,260 104,232 Z" fill={`url(#skin-${uid})`} />
      </g>

      {oGambe && <OutfitGambe outfit={oGambe} />}
      {oPiedi ? <OutfitPiedi outfit={oPiedi} /> : (
        <>
          <ellipse cx="88" cy="290" rx="12" ry="4" fill="#5a4a3a" />
          <ellipse cx="112" cy="290" rx="12" ry="4" fill="#5a4a3a" />
        </>
      )}
      {oPetto && <OutfitPetto outfit={oPetto} tetteEff={tetteEff} skinUid={uid} />}

      {/* TESTA */}
      <g filter={`url(#drop-${uid})`}>
        <ellipse cx="100" cy="86" rx="10" ry="3" fill={skinShadow} opacity="0.4" />
        <path d="M 78,55 Q 78,38 100,32 Q 122,38 122,55 Q 122,75 115,82 Q 108,87 100,87 Q 92,87 85,82 Q 78,75 78,55 Z" fill={`url(#skin-${uid})`} />
        <path d="M 95,45 Q 100,42 105,45 Q 105,55 100,57 Q 95,55 95,45" fill={skinHighlight} opacity="0.5" />
        <path d="M 84,62 Q 86,72 92,76" stroke={skinShadow} strokeWidth="0.6" fill="none" opacity="0.5" />
        <path d="M 116,62 Q 114,72 108,76" stroke={skinShadow} strokeWidth="0.6" fill="none" opacity="0.5" />
      </g>

      {/* OCCHI dettagliati */}
      <g>
        <path d="M 86,55 Q 91,53 96,55" stroke={darkenColor(cap.solid, 30)} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 104,55 Q 109,53 114,55" stroke={darkenColor(cap.solid, 30)} strokeWidth="1.5" fill="none" strokeLinecap="round" />

        <ellipse cx="91" cy="63" rx="3.5" ry="4.5" fill="white" />
        <ellipse cx="91" cy="64" rx="3" ry="4" fill={cap.solid === '#1a1a1a' ? '#3b82f6' : cap.solid} />
        <ellipse cx="91" cy="64" rx="1.5" ry="2.5" fill="black" />
        <circle cx="92" cy="62" r="1" fill="white" />
        <circle cx="90" cy="65" r="0.5" fill="white" opacity="0.7" />
        <path d="M 87,60 Q 89,58 93,59" stroke="black" strokeWidth="0.8" fill="none" strokeLinecap="round" />

        <ellipse cx="109" cy="63" rx="3.5" ry="4.5" fill="white" />
        <ellipse cx="109" cy="64" rx="3" ry="4" fill={cap.solid === '#1a1a1a' ? '#3b82f6' : cap.solid} />
        <ellipse cx="109" cy="64" rx="1.5" ry="2.5" fill="black" />
        <circle cx="110" cy="62" r="1" fill="white" />
        <circle cx="108" cy="65" r="0.5" fill="white" opacity="0.7" />
        <path d="M 107,60 Q 109,58 113,59" stroke="black" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      </g>

      <path d="M 100,68 L 99,74 Q 100,75 101,74 Z" fill={skinShadow} opacity="0.3" />

      <g>
        <path d="M 96,76 Q 100,79 104,76" stroke="#c47b7b" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 97,76.5 Q 100,77.5 103,76.5" stroke="#a85a5a" strokeWidth="0.6" fill="none" />
      </g>

      <ellipse cx="86" cy="71" rx="3" ry="2" fill="#ec4899" opacity="0.25" />
      <ellipse cx="114" cy="71" rx="3" ry="2" fill="#ec4899" opacity="0.25" />

      {/* CAPELLI ANTERIORI */}
      <g filter={`url(#drop-${uid})`}>
        <path d="M 80,40 Q 88,30 100,28 Q 112,30 120,40 L 122,52 Q 113,48 105,55 Q 100,52 95,55 Q 87,48 78,52 Z" fill={resolveCap(cap, uid)} />
        <path d="M 78,50 Q 75,65 73,82 Q 76,84 80,80 Q 82,68 84,55 Z" fill={resolveCap(cap, uid)} opacity="0.95" />
        <path d="M 122,50 Q 125,65 127,82 Q 124,84 120,80 Q 118,68 116,55 Z" fill={resolveCap(cap, uid)} opacity="0.95" />
        <path d="M 95,35 Q 100,32 105,35 L 103,42 Q 100,40 97,42 Z" fill={lightenColor(cap.solid, 50)} opacity="0.6" />
      </g>

      {/* Braccio destro */}
      <g transform={t.braccio_dx} filter={`url(#drop-${uid})`}>
        <path d="M 124,108 Q 124,135 127,160 Q 130,168 135,165 Q 138,135 136,108 Z" fill={`url(#skin-${uid})`} />
        <circle cx="131" cy="165" r="6" fill={`url(#skin-${uid})`} />
      </g>

      {oFaccia && <OutfitFaccia outfit={oFaccia} />}

      {sfondoRarita && <rect width="200" height="320" fill={`url(#vignette-${uid})`} pointerEvents="none" />}

      {posa && sfondoRarita && (
        <g>
          <rect x="50" y="298" width="100" height="14" rx="2" fill="rgba(0,0,0,0.7)" stroke={rar.colore} strokeWidth="0.5" opacity="0.9" />
          <text x="100" y="308" textAnchor="middle" fontSize="9" fill={rar.colore} fontFamily="Cinzel, serif" letterSpacing="2">⚜ {posa.nome.toUpperCase()} ⚜</text>
        </g>
      )}
    </svg>
  );
}

function lightenColor(hex, percent) {
  if (!hex || hex.startsWith('gradient')) return '#ffffff';
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
function darkenColor(hex, percent) {
  if (!hex || hex.startsWith('gradient')) return '#000000';
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
function resolveCap(cap, uid) {
  if (cap.hex === 'gradient-bicolor') return `url(#bicolor-${uid})`;
  if (cap.hex === 'gradient-fantasy') return `url(#fantasy-${uid})`;
  return `url(#hair-${uid})`;
}

function OutfitFaccia({ outfit }) {
  if (outfit.asset) return <image href={outfit.asset} x="78" y="30" width="44" height="50" />;
  const c = outfit.colore || '#888';
  const cLight = lightenColor(c, 30);
  switch (outfit.forma) {
    case 'glasses': return (
      <g>
        <circle cx="91" cy="64" r="6" fill="rgba(255,255,255,0.1)" stroke={c} strokeWidth="1.5" />
        <circle cx="109" cy="64" r="6" fill="rgba(255,255,255,0.1)" stroke={c} strokeWidth="1.5" />
        <line x1="97" y1="64" x2="103" y2="64" stroke={c} strokeWidth="1.5" />
        <path d="M 85,64 L 81,62" stroke={c} strokeWidth="1.2" />
        <path d="M 115,64 L 119,62" stroke={c} strokeWidth="1.2" />
      </g>
    );
    case 'tiara': return (
      <g>
        <path d="M 80,42 L 85,30 L 92,38 L 100,26 L 108,38 L 115,30 L 120,42 Q 110,46 100,46 Q 90,46 80,42 Z" fill={c} stroke="#fbbf24" strokeWidth="0.5" />
        <circle cx="100" cy="32" r="2.5" fill="#ec4899" stroke="#fff" strokeWidth="0.3" />
        <circle cx="92" cy="40" r="1" fill="#3b82f6" />
        <circle cx="108" cy="40" r="1" fill="#3b82f6" />
      </g>
    );
    case 'earrings': return (
      <g>
        <circle cx="78" cy="68" r="2.5" fill={c} stroke="#fff" strokeWidth="0.3" />
        <circle cx="78" cy="74" r="1.5" fill={c} opacity="0.7" />
        <circle cx="122" cy="68" r="2.5" fill={c} stroke="#fff" strokeWidth="0.3" />
        <circle cx="122" cy="74" r="1.5" fill={c} opacity="0.7" />
      </g>
    );
    case 'hat': return (
      <g>
        <ellipse cx="100" cy="42" rx="38" ry="6" fill={c} />
        <path d="M 82,42 Q 100,12 118,42 Z" fill={c} />
        <ellipse cx="100" cy="38" rx="22" ry="3" fill={cLight} opacity="0.5" />
      </g>
    );
    case 'mask': return (
      <g>
        <path d="M 78,58 Q 100,54 122,58 L 120,72 Q 100,76 80,72 Z" fill={c} opacity="0.92" />
        <ellipse cx="91" cy="64" rx="3.2" ry="2.2" fill="#0a0515" />
        <ellipse cx="109" cy="64" rx="3.2" ry="2.2" fill="#0a0515" />
      </g>
    );
    default: return null;
  }
}

function OutfitPetto({ outfit, tetteEff, skinUid }) {
  if (outfit.asset) return <image href={outfit.asset} x="55" y="85" width="90" height="100" />;
  const c = outfit.colore || '#888';
  const cLight = lightenColor(c, 25);
  const cDark = darkenColor(c, 20);
  const expand = (tetteEff - 3) * 0.6;

  switch (outfit.forma) {
    case 'tshirt': return (
      <g>
        <path d={`M ${72 - expand},103 Q ${75 - expand},94 100,93 Q ${125 + expand},94 ${128 + expand},103 L ${128 + expand},178 Q 100,184 ${72 - expand},178 Z`} fill={c} />
        <path d={`M ${72 - expand},103 Q 100,98 ${128 + expand},103`} stroke={cLight} strokeWidth="1" fill="none" opacity="0.6" />
      </g>
    );
    case 'dress': return (
      <g>
        <path d={`M ${72 - expand},103 Q 100,93 ${128 + expand},103 L 138,210 Q 100,220 62,210 Z`} fill={c} />
        <path d="M 90,103 Q 100,98 110,103 L 110,113 Q 100,116 90,113 Z" fill="#fff" opacity="0.5" />
        <path d="M 80,125 L 75,210" stroke={cDark} strokeWidth="0.5" opacity="0.4" />
        <path d="M 100,120 L 100,215" stroke={cDark} strokeWidth="0.5" opacity="0.3" />
        <path d="M 120,125 L 125,210" stroke={cDark} strokeWidth="0.5" opacity="0.4" />
      </g>
    );
    case 'bikini': return (
      <g>
        <path d={`M ${82 - expand / 2},108 Q 100,100 ${118 + expand / 2},108 L ${116 + expand / 2},124 Q 100,128 ${84 - expand / 2},124 Z`} fill={c} />
        <line x1={84 - expand / 2} y1="108" x2="80" y2="93" stroke={c} strokeWidth="2.5" />
        <line x1={116 + expand / 2} y1="108" x2="120" y2="93" stroke={c} strokeWidth="2.5" />
        <circle cx="100" cy="115" r="1.5" fill="#fbbf24" />
      </g>
    );
    case 'corset': return (
      <g>
        <path d={`M ${74 - expand},105 Q 100,95 ${126 + expand},105 L ${124 + expand},178 Q 100,184 ${76 - expand},178 Z`} fill={c} />
        <line x1="100" y1="108" x2="100" y2="174" stroke="#fbbf24" strokeWidth="0.6" strokeDasharray="3,2" />
        {[...Array(7)].map((_, i) => (
          <line key={i} x1="96" y1={115 + i * 9} x2="104" y2={115 + i * 9} stroke="#fbbf24" strokeWidth="0.5" />
        ))}
        <path d={`M ${74 - expand},105 Q 100,95 ${126 + expand},105`} fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      </g>
    );
    case 'armor': return (
      <g>
        <path d={`M ${72 - expand},103 Q 100,93 ${128 + expand},103 L ${130 + expand},180 Q 100,186 ${70 - expand},180 Z`} fill={c} />
        <path d="M 100,98 L 92,120 L 100,116 L 108,120 Z" fill="#fbbf24" stroke="#fff" strokeWidth="0.5" />
        <circle cx="100" cy="118" r="2" fill="#ef4444" stroke="#fbbf24" strokeWidth="0.5" />
        <line x1="78" y1="135" x2="122" y2="135" stroke="#fbbf24" strokeWidth="0.8" opacity="0.7" />
        {[80, 95, 105, 120].map(x => <circle key={x} cx={x} cy="170" r="1.5" fill="#fbbf24" />)}
      </g>
    );
    default: return null;
  }
}

function OutfitGambe({ outfit }) {
  if (outfit.asset) return <image href={outfit.asset} x="65" y="195" width="70" height="95" />;
  const c = outfit.colore || '#888';
  const cLight = lightenColor(c, 20);
  const cDark = darkenColor(c, 25);
  switch (outfit.forma) {
    case 'pants': return (
      <g>
        <path d="M 78,200 L 98,202 L 96,288 L 80,288 Z" fill={c} />
        <path d="M 102,202 L 122,200 L 120,288 L 104,288 Z" fill={c} />
        <line x1="86" y1="210" x2="86" y2="285" stroke={cDark} strokeWidth="0.4" opacity="0.5" />
        <line x1="114" y1="210" x2="114" y2="285" stroke={cDark} strokeWidth="0.4" opacity="0.5" />
      </g>
    );
    case 'skirt': return (
      <g>
        <path d="M 70,200 Q 100,196 130,200 L 142,232 L 58,232 Z" fill={c} />
        {[68, 80, 92, 108, 120, 132].map((x, i) => (
          <line key={i} x1={x} y1="208" x2={50 + i * 16} y2="232" stroke={cDark} strokeWidth="0.5" opacity="0.5" />
        ))}
        <path d="M 70,200 Q 100,196 130,200" stroke={cLight} strokeWidth="0.8" fill="none" opacity="0.6" />
      </g>
    );
    case 'tights': return (
      <g>
        <path d="M 80,200 L 96,202 L 95,288 L 82,288 Z" fill={c} opacity="0.55" />
        <path d="M 104,202 L 120,200 L 118,288 L 105,288 Z" fill={c} opacity="0.55" />
      </g>
    );
    default: return null;
  }
}

function OutfitPiedi({ outfit }) {
  if (outfit.asset) return <image href={outfit.asset} x="70" y="280" width="60" height="20" />;
  const c = outfit.colore || '#888';
  const cLight = lightenColor(c, 20);
  switch (outfit.forma) {
    case 'sneakers': return (
      <g>
        <ellipse cx="88" cy="291" rx="13" ry="6" fill={c} />
        <ellipse cx="112" cy="291" rx="13" ry="6" fill={c} />
        <ellipse cx="88" cy="294" rx="13" ry="2" fill={cLight} opacity="0.6" />
        <ellipse cx="112" cy="294" rx="13" ry="2" fill={cLight} opacity="0.6" />
      </g>
    );
    case 'boots': return (
      <g>
        <path d="M 78,255 L 98,255 L 96,295 L 80,295 Z" fill={c} />
        <path d="M 102,255 L 122,255 L 120,295 L 104,295 Z" fill={c} />
        <ellipse cx="88" cy="296" rx="11" ry="3" fill={c} />
        <ellipse cx="112" cy="296" rx="11" ry="3" fill={c} />
        {[260, 268, 276, 284].map((y, i) => (
          <g key={i}>
            <line x1="82" y1={y} x2="94" y2={y} stroke="#fbbf24" strokeWidth="0.6" />
            <line x1="106" y1={y} x2="118" y2={y} stroke="#fbbf24" strokeWidth="0.6" />
          </g>
        ))}
      </g>
    );
    case 'heels': return (
      <g>
        <path d="M 78,288 L 98,288 L 96,294 L 80,294 Z" fill={c} />
        <path d="M 102,288 L 122,288 L 120,294 L 104,294 Z" fill={c} />
        <line x1="92" y1="294" x2="92" y2="305" stroke={c} strokeWidth="2" />
        <line x1="116" y1="294" x2="116" y2="305" stroke={c} strokeWidth="2" />
      </g>
    );
    case 'sandals': return (
      <g>
        <ellipse cx="88" cy="293" rx="12" ry="3" fill={c} />
        <ellipse cx="112" cy="293" rx="12" ry="3" fill={c} />
        <path d="M 80,288 L 88,293 L 96,288" stroke={c} strokeWidth="1.5" fill="none" />
        <path d="M 104,288 L 112,293 L 120,288" stroke={c} strokeWidth="1.5" fill="none" />
      </g>
    );
    default: return null;
  }
}
