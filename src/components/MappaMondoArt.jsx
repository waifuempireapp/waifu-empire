// src/components/MappaMondoArt.jsx
// Mappa mondo con art direction stile Genshin/HSR:
// - Sfondo a pergamena con texture
// - Oceano con onde decorative
// - Continenti con illustrazioni e texture
// - Fog of war sui territori non ancora conquistati
// - Bussola e bordo ornamentale
// - Particolari decorativi (mostri marini, navi, rose dei venti)

'use client';
import React from 'react';
import { TERRITORI, COLORI_CONTINENTI, NOMI_CONTINENTI } from '@/lib/constants';

export default function MappaMondoArt({
  territoriUtente = {},
  coloreImpero = '#f59e0b',
  nomeImpero = 'Il Tuo Impero',
  onTerritorioClick,
  territorioSelezionato,
  width = '100%',
  height = '70vh',
}) {
  return (
    <div style={{
      position: 'relative',
      width, height,
      background: 'radial-gradient(ellipse at 30% 30%, #1a1228 0%, #0a0515 60%, #000 100%)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '2px solid rgba(245,158,11,0.4)',
      boxShadow: '0 0 60px rgba(168,85,247,0.3), inset 0 0 80px rgba(0,0,0,0.5)',
    }}>
      <svg viewBox="0 0 1050 700" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <defs>
          {/* === GRADIENT OCEANO === */}
          <radialGradient id="ocean-grad" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#1a3a5c" />
            <stop offset="60%" stopColor="#0d2240" />
            <stop offset="100%" stopColor="#050d1f" />
          </radialGradient>

          {/* === PATTERN ONDE OCEANO === */}
          <pattern id="ocean-waves" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
            <path d="M0,15 Q15,8 30,15 T60,15" stroke="rgba(120,180,220,0.15)" strokeWidth="0.8" fill="none" />
            <path d="M0,22 Q15,17 30,22 T60,22" stroke="rgba(120,180,220,0.08)" strokeWidth="0.6" fill="none" />
          </pattern>

          {/* === PATTERN PERGAMENA TERRA === */}
          <pattern id="parchment" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#2a1f15" />
            <circle cx="10" cy="10" r="0.5" fill="#f5e6d3" opacity="0.1" />
            <circle cx="30" cy="20" r="0.4" fill="#f5e6d3" opacity="0.08" />
            <circle cx="20" cy="35" r="0.3" fill="#f5e6d3" opacity="0.06" />
            <path d="M5,25 L8,28" stroke="#f5e6d3" strokeWidth="0.2" opacity="0.1" />
          </pattern>

          {/* === PATTERN MONTAGNE (icone decorative su continenti) === */}
          <symbol id="mountain" viewBox="0 0 20 20">
            <path d="M3,16 L8,6 L11,11 L14,4 L17,16 Z" fill="#5a4a3a" stroke="#8b6f4d" strokeWidth="0.5" />
            <path d="M8,6 L9.5,8.5 L7,14" fill="#f5e6d3" opacity="0.4" />
            <path d="M14,4 L15.5,7 L13,12" fill="#f5e6d3" opacity="0.4" />
          </symbol>
          <symbol id="forest" viewBox="0 0 20 20">
            <circle cx="10" cy="11" r="5" fill="#1d4a2c" />
            <circle cx="7" cy="9" r="3" fill="#2d6a3c" />
            <circle cx="13" cy="9" r="3" fill="#2d6a3c" />
          </symbol>
          <symbol id="castle" viewBox="0 0 20 20">
            <rect x="6" y="9" width="8" height="8" fill="#6b4423" stroke="#3d2818" strokeWidth="0.4" />
            <rect x="5" y="6" width="2" height="4" fill="#6b4423" stroke="#3d2818" strokeWidth="0.4" />
            <rect x="9" y="4" width="2" height="6" fill="#6b4423" stroke="#3d2818" strokeWidth="0.4" />
            <rect x="13" y="6" width="2" height="4" fill="#6b4423" stroke="#3d2818" strokeWidth="0.4" />
            <path d="M5,6 L6,4 L7,6 Z M9,4 L10,2 L11,4 Z M13,6 L14,4 L15,6 Z" fill="#ef4444" />
          </symbol>

          {/* === FOG OF WAR === */}
          <radialGradient id="fog-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(8,4,16,0.35)" />
            <stop offset="100%" stopColor="rgba(8,4,16,0.85)" />
          </radialGradient>

          <filter id="fog-blur">
            <feGaussianBlur stdDeviation="3" />
          </filter>

          {/* === GRADIENT CONTINENTI (ognuno una palette diversa) === */}
          {Object.entries(COLORI_CONTINENTI).map(([key, c]) => (
            <linearGradient key={key} id={`cont-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={lighten(c, 15)} />
              <stop offset="60%" stopColor={c} />
              <stop offset="100%" stopColor={darken(c, 25)} />
            </linearGradient>
          ))}

          {/* === GLOW FILTER === */}
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* === ROSA DEI VENTI === */}
          <symbol id="compass" viewBox="-50 -50 100 100">
            <circle r="45" fill="rgba(245,230,211,0.06)" stroke="#f5e6d3" strokeWidth="0.8" opacity="0.7" />
            <circle r="40" fill="none" stroke="#f5e6d3" strokeWidth="0.4" opacity="0.5" strokeDasharray="3,2" />
            {/* 8 punti cardinali */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * 45) * Math.PI / 180;
              const len = i % 2 === 0 ? 38 : 28;
              return <line key={i}
                x1={0} y1={0}
                x2={Math.sin(angle) * len} y2={-Math.cos(angle) * len}
                stroke="#f5e6d3" strokeWidth={i % 2 === 0 ? 1 : 0.5} opacity="0.6" />;
            })}
            {/* Stella centrale */}
            <path d="M0,-35 L5,-5 L35,0 L5,5 L0,35 L-5,5 L-35,0 L-5,-5 Z" fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.5" opacity="0.85" />
            <circle r="3" fill="#fbbf24" />
            <text y="-40" textAnchor="middle" fill="#f5e6d3" fontSize="6" fontFamily="Cinzel, serif" opacity="0.8">N</text>
            <text y="44" textAnchor="middle" fill="#f5e6d3" fontSize="6" fontFamily="Cinzel, serif" opacity="0.8">S</text>
            <text x="40" y="2" textAnchor="middle" fill="#f5e6d3" fontSize="6" fontFamily="Cinzel, serif" opacity="0.8">E</text>
            <text x="-40" y="2" textAnchor="middle" fill="#f5e6d3" fontSize="6" fontFamily="Cinzel, serif" opacity="0.8">W</text>
          </symbol>

          {/* === MOSTRO MARINO (kraken) === */}
          <symbol id="kraken" viewBox="0 0 60 40">
            <ellipse cx="30" cy="22" rx="14" ry="8" fill="#3d2147" opacity="0.7" />
            <path d="M16,22 Q10,15 5,18 Q3,22 8,24" fill="#3d2147" opacity="0.6" />
            <path d="M44,22 Q50,15 55,18 Q57,22 52,24" fill="#3d2147" opacity="0.6" />
            <path d="M20,28 Q15,35 18,38" fill="#3d2147" opacity="0.5" />
            <path d="M40,28 Q45,35 42,38" fill="#3d2147" opacity="0.5" />
            <circle cx="26" cy="20" r="1.5" fill="#ef4444" />
            <circle cx="34" cy="20" r="1.5" fill="#ef4444" />
          </symbol>

          {/* === NAVE === */}
          <symbol id="ship" viewBox="0 0 30 25">
            <path d="M2,16 L28,16 L25,22 L5,22 Z" fill="#6b4423" stroke="#3d2818" strokeWidth="0.4" />
            <line x1="15" y1="16" x2="15" y2="3" stroke="#3d2818" strokeWidth="0.5" />
            <path d="M15,4 L23,12 L15,12 Z" fill="#f5e6d3" opacity="0.85" />
            <path d="M15,4 L7,12 L15,12 Z" fill="#f5e6d3" opacity="0.7" />
          </symbol>

          {/* === BORDO PERGAMENA === */}
          <pattern id="border-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M0,10 L5,5 L10,10 L15,5 L20,10" stroke="#f59e0b" strokeWidth="0.6" fill="none" opacity="0.8" />
          </pattern>
        </defs>

        {/* === SFONDO OCEANO === */}
        <rect width="1050" height="700" fill="url(#ocean-grad)" />
        <rect width="1050" height="700" fill="url(#ocean-waves)" />

        {/* === ONDINE DECORATIVE OCEANO === */}
        <g opacity="0.4">
          <path d="M50,400 Q80,395 110,400 T170,400" stroke="rgba(180,220,255,0.5)" strokeWidth="0.8" fill="none" />
          <path d="M850,250 Q880,245 910,250 T970,250" stroke="rgba(180,220,255,0.5)" strokeWidth="0.8" fill="none" />
          <path d="M450,620 Q480,615 510,620 T570,620" stroke="rgba(180,220,255,0.5)" strokeWidth="0.8" fill="none" />
          <path d="M150,580 Q180,575 210,580 T270,580" stroke="rgba(180,220,255,0.4)" strokeWidth="0.6" fill="none" />
        </g>

        {/* === KRAKEN E NAVI DECORATIVE === */}
        <use href="#kraken" x="100" y="380" width="60" height="40" />
        <use href="#kraken" x="800" y="600" width="50" height="34" />
        <use href="#ship" x="450" y="100" width="30" height="25" />
        <use href="#ship" x="700" y="540" width="25" height="20" />

        {/* === ROSE DEI VENTI === */}
        <use href="#compass" x="950" y="120" width="80" height="80" />

        {/* === AREE CONTINENTALI (forme aggregate) === */}
        {/* North America */}
        <path d="M40,75 L460,80 L450,140 L460,180 L370,200 L370,280 L320,275 L290,345 L195,340 L165,310 L155,180 L40,160 Z"
              fill="url(#cont-NA)" opacity="0.3" />
        {/* South America */}
        <path d="M275,355 L420,360 L420,505 L390,510 L390,620 L295,615 L275,510 L240,420 Z"
              fill="url(#cont-SA)" opacity="0.3" />
        {/* Europe */}
        <path d="M455,140 L735,160 L735,260 L640,330 L545,320 L485,280 L460,190 Z"
              fill="url(#cont-EU)" opacity="0.3" />
        {/* Africa */}
        <path d="M540,325 L735,330 L725,535 L555,525 Z"
              fill="url(#cont-AF)" opacity="0.3" />
        {/* Asia */}
        <path d="M735,150 L1000,160 L1000,335 L935,460 L800,470 L735,400 L735,250 Z"
              fill="url(#cont-AS)" opacity="0.3" />
        {/* Oceania */}
        <path d="M855,455 L1000,460 L1000,605 L880,605 L860,510 Z"
              fill="url(#cont-OC)" opacity="0.3" />

        {/* === TERRITORI === */}
        {TERRITORI.map(t => {
          const datiUt = territoriUtente[t.id];
          const conquistato = datiUt?.conquistato;
          const selez = territorioSelezionato === t.id;

          // Colore territorio basato sull'impero che lo possiede
          let fillCol, strokeCol, opac, strokeW;
          if (conquistato) {
            // PROPRI: molto evidenti
            fillCol = coloreImpero;
            strokeCol = lighten(coloreImpero, 40);
            opac = 0.95;
            strokeW = 2.5;
          } else if (datiUt?.coloreImpero) {
            fillCol = datiUt.coloreImpero;
            strokeCol = lighten(datiUt.coloreImpero, 15);
            opac = 0.5;
            strokeW = 1;
          } else {
            fillCol = `url(#cont-${t.cont})`;
            strokeCol = '#444';
            opac = 0.3;
            strokeW = 0.8;
          }

          // Check se confinante con territori del player (pulsazione forte)
          const mieiTerrIds = Object.entries(territoriUtente).filter(([, v]) => v?.conquistato).map(([k]) => k);
          const primoAttacco = mieiTerrIds.length === 0;
          const eConfinante = !conquistato && (primoAttacco || (t.conf || []).some(cId => mieiTerrIds.includes(cId)));

          return (
            <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => onTerritorioClick && onTerritorioClick(t)}>
              {/* Glow esterno per propri territori */}
              {conquistato && (
                <path d={t.path} fill="none" stroke={coloreImpero} strokeWidth="4" opacity="0.3" filter="url(#glow-strong)" />
              )}
              <path d={t.path}
                fill={fillCol}
                stroke={selez ? '#fbbf24' : eConfinante ? '#fbbf24' : strokeCol}
                strokeWidth={selez ? 3 : eConfinante ? 2.5 : strokeW}
                opacity={opac}
                filter={selez ? 'url(#glow-strong)' : undefined}
              >
                {eConfinante && <animate attributeName="opacity" values="0.5;0.85;0.5" dur="1.5s" repeatCount="indefinite" />}
                {eConfinante && <animate attributeName="stroke-width" values="2;3.5;2" dur="1.5s" repeatCount="indefinite" />}
              </path>
              {conquistato && <use href="#castle" x={t.cx - 10} y={t.cy - 10} width="20" height="20" opacity="0.85" />}
              {!conquistato && (t.cont === 'NA' || t.cont === 'EU' || t.cont === 'AS') && <use href="#mountain" x={t.cx - 8} y={t.cy - 8} width="16" height="16" opacity="0.5" />}
              {!conquistato && (t.cont === 'SA' || t.cont === 'AF') && <use href="#forest" x={t.cx - 8} y={t.cy - 8} width="16" height="16" opacity="0.5" />}
              <text x={t.cx} y={t.cy + 18} textAnchor="middle" fontSize="9" fontFamily="Cinzel, serif"
                fill={conquistato ? '#fbbf24' : eConfinante ? '#fff' : '#f5e6d3'}
                stroke="#000" strokeWidth="0.4" paintOrder="stroke" opacity="0.95"
                style={{ letterSpacing: 0.5, fontWeight: conquistato || eConfinante ? 700 : 600 }}>
                {t.nome}
              </text>
              {conquistato && (
                <g transform={`translate(${t.cx - 4}, ${t.cy - 16})`}>
                  <line x1="4" y1="0" x2="4" y2="12" stroke="#3d2818" strokeWidth="0.8" />
                  <path d="M4,0 L12,3 L4,6 Z" fill={coloreImpero} stroke="#fbbf24" strokeWidth="0.4" />
                </g>
              )}
              {eConfinante && (
                <circle cx={t.cx} cy={t.cy - 20} r="4" fill="#fbbf24" opacity="0.8">
                  <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* === FOG OF WAR sui territori NON conquistati === */}
        {/* Effetto sottile di nebbia che copre le aree esplorabili */}
        {TERRITORI.filter(t => !territoriUtente[t.id]?.conquistato).map(t => (
          <path key={`fog-${t.id}`} d={t.path}
            fill="rgba(8,4,16,0.25)"
            pointerEvents="none"
          />
        ))}

        {/* === BORDO ORNAMENTALE === */}
        <rect x="6" y="6" width="1038" height="688" fill="none" stroke="url(#border-pattern)" strokeWidth="3" opacity="0.6" />
        <rect x="14" y="14" width="1022" height="672" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.4" />

        {/* Angoli ornamentali */}
        {[
          { x: 0, y: 0, rot: 0 },
          { x: 1050, y: 0, rot: 90 },
          { x: 1050, y: 700, rot: 180 },
          { x: 0, y: 700, rot: 270 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x},${c.y}) rotate(${c.rot})`}>
            <path d="M10,10 L40,10 L40,14 L14,14 L14,40 L10,40 Z" fill="#f59e0b" opacity="0.85" />
            <circle cx="14" cy="14" r="2.5" fill="#fbbf24" />
            <path d="M20,14 L36,14" stroke="#fbbf24" strokeWidth="0.4" opacity="0.7" />
            <path d="M14,20 L14,36" stroke="#fbbf24" strokeWidth="0.4" opacity="0.7" />
          </g>
        ))}

        {/* === LEGENDA IMPERI (in basso a sinistra) === */}
        <g transform="translate(20, 545)">
          {(() => {
            const imperiMap = {};
            let mioCount = 0;
            Object.values(territoriUtente).forEach(v => {
              if (v?.conquistato) { mioCount++; return; }
              if (v?.impero && v?.coloreImpero) {
                if (!imperiMap[v.impero]) imperiMap[v.impero] = { colore: v.coloreImpero, count: 0 };
                imperiMap[v.impero].count++;
              }
            });
            // Max 4 imperi avversari + il mio = 5 totali
            const avversari = Object.entries(imperiMap).sort((a, b) => b[1].count - a[1].count).slice(0, 4);
            // Proprio impero sempre primo
            const lista = [];
            if (mioCount > 0) lista.push([nomeImpero, { colore: coloreImpero, count: mioCount, mio: true }]);
            avversari.forEach(([n, d]) => lista.push([n, d]));
            const h = lista.length * 20 + 30;
            return (
              <>
                <rect x="-4" y="-4" width="280" height={h + 8} rx="6" fill="rgba(10,5,21,0.92)" stroke="#f59e0b" strokeWidth="0.8" />
                <text x="136" y="14" textAnchor="middle" fontSize="9" fontFamily="Cinzel, serif" fill="#f59e0b" letterSpacing="2">⚜ IMPERI ⚜</text>
                {lista.map(([nome, { colore, count, mio }], i) => (
                  <g key={nome} transform={`translate(8, ${i * 20 + 26})`}>
                    <rect x="0" y="0" width="14" height="14" rx="3" fill={colore} stroke={mio ? '#fbbf24' : '#f5e6d3'} strokeWidth={mio ? 1.5 : 0.3} />
                    {mio && <text x="7" y="11" textAnchor="middle" fontSize="8" fill="#000" fontWeight="700">★</text>}
                    <text x="20" y="11" fontSize={mio ? '9' : '8'} fill={mio ? '#fbbf24' : '#f5e6d3'} fontFamily="Inter, sans-serif" fontWeight={mio ? '700' : '400'}>
                      {nome} ({count})
                    </text>
                  </g>
                ))}
              </>
            );
          })()}
        </g>

        {/* === TITOLO MAPPA in alto === */}
        <g transform="translate(525, 38)">
          <rect x="-190" y="-24" width="380" height="44" rx="5"
                fill="rgba(10,5,21,0.94)" stroke="#f59e0b" strokeWidth="1.2" />
          <text textAnchor="middle" y="6" fontSize="17"
                fontFamily="Cinzel, serif" fill="#f59e0b" letterSpacing="4"
                style={{ fontWeight: 700 }}>
            ⚔ MONDO CONOSCIUTO ⚔
          </text>
        </g>

        {/* === CONTATORE TERRITORI conquistati === */}
        <g transform="translate(900, 620)">
          <rect x="0" y="0" width="130" height="50" rx="3"
                fill="rgba(10,5,21,0.85)" stroke={coloreImpero} strokeWidth="0.8" />
          <text x="65" y="14" textAnchor="middle" fontSize="8"
                fontFamily="Cinzel, serif" fill={coloreImpero} letterSpacing="2">CONQUISTATI</text>
          <text x="65" y="38" textAnchor="middle" fontSize="20"
                fontFamily="Cinzel, serif" fill="#fbbf24" fontWeight="700">
            {Object.values(territoriUtente).filter(t => t?.conquistato).length} / {TERRITORI.length}
          </text>
        </g>
      </svg>
    </div>
  );
}

function lighten(hex, percent) {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
function darken(hex, percent) {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
