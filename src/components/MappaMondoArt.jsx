// src/components/MappaMondoArt.jsx
// Mappa reworkata — stile neon/holographic su sfondo scuro
// Popup territorio restano INVARIATI (gestiti dal parent MappaTab)
'use client';
import React from 'react';
import { TERRITORI, COLORI_CONTINENTI, NOMI_CONTINENTI } from '@/lib/constants';

export default function MappaMondoArt({
  territoriUtente = {},
  coloreImpero = '#f5a623',
  nomeImpero = 'Il Tuo Impero',
  onTerritorioClick,
  territorioSelezionato,
  width = '100%',
  height = '70vh',
}) {
  const mieiTerrIds = Object.entries(territoriUtente).filter(([, v]) => v?.conquistato).map(([k]) => k);
  const primoAttacco = mieiTerrIds.length === 0;

  return (
    <div style={{
      position: 'relative',
      width, height,
      background: 'radial-gradient(ellipse at 40% 30%, #0d0820 0%, #06030f 60%, #000 100%)',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(245,166,35,0.2)',
      boxShadow: '0 0 40px rgba(155,89,255,0.15), inset 0 0 60px rgba(0,0,0,0.4)',
    }}>
      <svg viewBox="0 0 1050 700" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <defs>
          {/* Oceano scuro */}
          <radialGradient id="ocean-g" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#0a1520" />
            <stop offset="100%" stopColor="#030810" />
          </radialGradient>

          {/* Grid pattern sottile */}
          <pattern id="grid-p" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50,0 L50,50 M0,50 L50,50" stroke="rgba(155,89,255,0.06)" strokeWidth="0.5" />
          </pattern>

          {/* Hex pattern */}
          <pattern id="hex-p" width="30" height="26" patternUnits="userSpaceOnUse">
            <path d="M15,0 L30,7.5 L30,18.5 L15,26 L0,18.5 L0,7.5 Z" fill="none" stroke="rgba(245,166,35,0.04)" strokeWidth="0.3" />
          </pattern>

          {/* Gradient continenti */}
          {Object.entries(COLORI_CONTINENTI).map(([key, c]) => (
            <linearGradient key={key} id={`cg-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={lighten(c, 10)} />
              <stop offset="100%" stopColor={darken(c, 30)} />
            </linearGradient>
          ))}

          {/* Glow filter */}
          <filter id="glow-s">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-w">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Sfondo oceano */}
        <rect width="1050" height="700" fill="url(#ocean-g)" />
        <rect width="1050" height="700" fill="url(#grid-p)" />
        <rect width="1050" height="700" fill="url(#hex-p)" />

        {/* Ondine scanline */}
        {[...Array(6)].map((_, i) => (
          <line key={i} x1="0" y1={120 + i * 100} x2="1050" y2={120 + i * 100}
            stroke="rgba(0,229,255,0.03)" strokeWidth="0.5" />
        ))}

        {/* === TERRITORI === */}
        {TERRITORI.map(t => {
          const terrData = territoriUtente[t.id] || {};
          const conquistato = terrData.conquistato;
          const selez = territorioSelezionato === t.id;
          const eConfinante = !conquistato && (primoAttacco || (t.conf || []).some(cId => mieiTerrIds.includes(cId)));

          let fillCol, strokeCol, opac, strokeW;
          if (conquistato) {
            fillCol = coloreImpero + '55';
            strokeCol = coloreImpero;
            opac = 1;
            strokeW = 2;
          } else if (eConfinante) {
            fillCol = `url(#cg-${t.cont})`;
            strokeCol = '#ffd666';
            opac = 0.75;
            strokeW = 1.5;
          } else {
            fillCol = `url(#cg-${t.cont})`;
            strokeCol = COLORI_CONTINENTI[t.cont] + '50';
            opac = 0.35;
            strokeW = 0.8;
          }

          return (
            <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => onTerritorioClick && onTerritorioClick(t)}>
              {/* Glow per territori propri */}
              {conquistato && (
                <path d={t.path} fill="none" stroke={coloreImpero} strokeWidth="5" opacity="0.2" filter="url(#glow-w)" />
              )}
              <path d={t.path}
                fill={fillCol}
                stroke={selez ? '#ffd666' : strokeCol}
                strokeWidth={selez ? 3 : strokeW}
                opacity={opac}
                filter={selez ? 'url(#glow-s)' : undefined}
                style={{ transition: 'all 0.3s' }}
              >
                {eConfinante && <animate attributeName="opacity" values="0.5;0.85;0.5" dur="2s" repeatCount="indefinite" />}
              </path>

              {/* Icone */}
              {conquistato && (
                <g transform={`translate(${t.cx - 5}, ${t.cy - 8})`}>
                  <text fontSize="14" fill={coloreImpero} textAnchor="middle" x="5" y="10"
                    style={{ filter: `drop-shadow(0 0 4px ${coloreImpero})` }}>⚑</text>
                </g>
              )}

              {/* Nome territorio */}
              <text x={t.cx} y={t.cy + (conquistato ? 14 : 6)} textAnchor="middle"
                fontSize={conquistato || eConfinante ? '9' : '8'}
                fontFamily="Orbitron, sans-serif"
                fill={conquistato ? '#ffd666' : eConfinante ? '#fff' : 'rgba(238,232,220,0.5)'}
                stroke="rgba(0,0,0,0.7)" strokeWidth="0.3" paintOrder="stroke"
                style={{ letterSpacing: 0.5, fontWeight: conquistato || eConfinante ? 700 : 400 }}>
                {t.nome}
              </text>

              {/* Indicatore confinante */}
              {eConfinante && (
                <circle cx={t.cx} cy={t.cy - 14} r="3" fill="#ffd666" opacity="0.7">
                  <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* === BORDO === */}
        <rect x="8" y="8" width="1034" height="684" fill="none" stroke="rgba(245,166,35,0.12)" strokeWidth="1" rx="8" />

        {/* Angoli bordo */}
        {[
          { x: 4, y: 4, r: 0 }, { x: 1046, y: 4, r: 90 },
          { x: 1046, y: 696, r: 180 }, { x: 4, y: 696, r: 270 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x},${c.y}) rotate(${c.r})`}>
            <path d="M4,4 L30,4 L30,6 L6,6 L6,30 L4,30 Z" fill="#f5a623" opacity="0.5" />
          </g>
        ))}

        {/* === TITOLO === */}
        <g transform="translate(525, 34)">
          <rect x="-140" y="-18" width="280" height="34" rx="6"
            fill="rgba(6,3,15,0.85)" stroke="rgba(245,166,35,0.3)" strokeWidth="1" />
          <text textAnchor="middle" y="5" fontSize="12"
            fontFamily="Orbitron, sans-serif" fill="#f5a623" letterSpacing="3" fontWeight="700">
            MONDO CONOSCIUTO
          </text>
        </g>

        {/* === CONTATORE === */}
        <g transform="translate(910, 630)">
          <rect x="0" y="0" width="120" height="44" rx="6"
            fill="rgba(6,3,15,0.85)" stroke={coloreImpero + '50'} strokeWidth="0.8" />
          <text x="60" y="14" textAnchor="middle" fontSize="7"
            fontFamily="Orbitron, sans-serif" fill={coloreImpero} letterSpacing="2">CONQUISTATI</text>
          <text x="60" y="34" textAnchor="middle" fontSize="16"
            fontFamily="Orbitron, sans-serif" fill="#ffd666" fontWeight="700">
            {Object.values(territoriUtente).filter(t => t?.conquistato).length} / {TERRITORI.length}
          </text>
        </g>

        {/* === LEGENDA IMPERI === */}
        <g transform="translate(18, 560)">
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
            const avversari = Object.entries(imperiMap).sort((a, b) => b[1].count - a[1].count).slice(0, 4);
            const lista = [];
            if (mioCount > 0) lista.push([nomeImpero, { colore: coloreImpero, count: mioCount, mio: true }]);
            avversari.forEach(([n, d]) => lista.push([n, d]));
            const h = lista.length * 18 + 24;
            return (
              <>
                <rect x="-4" y="-4" width="220" height={h + 8} rx="6" fill="rgba(6,3,15,0.85)" stroke="rgba(245,166,35,0.15)" strokeWidth="0.5" />
                <text x="106" y="12" textAnchor="middle" fontSize="7" fontFamily="Orbitron, sans-serif" fill="#f5a623" letterSpacing="3">IMPERI</text>
                {lista.map(([nome, { colore, count, mio }], i) => (
                  <g key={nome} transform={`translate(6, ${i * 18 + 22})`}>
                    <rect x="0" y="0" width="10" height="10" rx="2" fill={colore} stroke={mio ? '#ffd666' : 'none'} strokeWidth={mio ? 1 : 0} />
                    <text x="16" y="9" fontSize="8" fill={mio ? '#ffd666' : 'rgba(238,232,220,0.7)'} fontFamily="Fredoka, sans-serif" fontWeight={mio ? '700' : '400'}>
                      {nome} ({count})
                    </text>
                  </g>
                ))}
              </>
            );
          })()}
        </g>

        {/* === BUSSOLA MINIMALISTA === */}
        <g transform="translate(980, 80)">
          <circle r="22" fill="rgba(6,3,15,0.7)" stroke="rgba(245,166,35,0.2)" strokeWidth="0.5" />
          {[0, 90, 180, 270].map((a, i) => {
            const rad = a * Math.PI / 180;
            return <line key={i} x1={0} y1={0} x2={Math.sin(rad) * 18} y2={-Math.cos(rad) * 18}
              stroke="rgba(245,166,35,0.3)" strokeWidth="0.5" />;
          })}
          <path d="M0,-18 L3,-3 L0,4 L-3,-3 Z" fill="#f5a623" opacity="0.7" />
          <path d="M0,18 L3,3 L0,-4 L-3,3 Z" fill="rgba(245,166,35,0.3)" />
          <circle r="2" fill="#ffd666" />
          <text y="-20" textAnchor="middle" fill="rgba(245,166,35,0.6)" fontSize="5" fontFamily="Orbitron">N</text>
        </g>
      </svg>
    </div>
  );
}

function lighten(hex, pct) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const a = Math.round(2.55 * pct);
    const R = Math.min(255, (n >> 16) + a);
    const G = Math.min(255, ((n >> 8) & 0xFF) + a);
    const B = Math.min(255, (n & 0xFF) + a);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
function darken(hex, pct) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const a = Math.round(2.55 * pct);
    const R = Math.max(0, (n >> 16) - a);
    const G = Math.max(0, ((n >> 8) & 0xFF) - a);
    const B = Math.max(0, (n & 0xFF) - a);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  } catch { return hex; }
}
