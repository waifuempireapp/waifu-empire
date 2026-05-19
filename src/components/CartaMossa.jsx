// src/components/CartaMossa.jsx
// Carta mossa attacco — identica nella struttura visiva a CartaWaifu
'use client';
import React from 'react';
import { RARITA } from '@/lib/constants';

// ── Palette rarità — identica a CartaWaifu ────────────────────────────────
const RARITY_BORDER = {
  comune:      { outer: '#b4bcc8', inner: '#dfe5ef', glow: 'rgba(180,188,200,0.45)', bg: 'linear-gradient(160deg, #293142 0%, #0c0e1a 100%)' },
  raro:        { outer: '#5aa9ff', inner: '#9fcaff', glow: 'rgba(90,169,255,0.55)',  bg: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)' },
  epico:       { outer: '#b573ff', inner: '#dabaff', glow: 'rgba(181,115,255,0.55)', bg: 'linear-gradient(160deg, #2a1255 0%, #10052a 100%)' },
  leggendario: { outer: '#ffc861', inner: '#ffe9a8', glow: 'rgba(255,200,97,0.65)',  bg: 'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)' },
  immersivo:   { outer: '#ff7eb6', inner: '#ffc3da', glow: 'rgba(255,126,182,0.7)',  bg: 'linear-gradient(160deg, #4f1245 0%, #1e0420 100%)' },
};

// ── Colori per tipo mossa ─────────────────────────────────────────────────
const TIPO_COLORS = {
  Arcana: { accent: '#9b7dff', bg: 'rgba(155,125,255,0.18)', icon: '✦' },
  Natura: { accent: '#6cf090', bg: 'rgba(108,240,144,0.18)', icon: '❋' },
  Abisso: { accent: '#60a4ff', bg: 'rgba(96,164,255,0.18)',  icon: '◉' },
  Ferro:  { accent: '#c0c8d4', bg: 'rgba(192,200,212,0.18)', icon: '⬡' },
  Fuoco:  { accent: '#ff8c5a', bg: 'rgba(255,140,90,0.18)',  icon: '◈' },
};

// ── Cerchio stat (uguale a StatCircle di CartaWaifu) ─────────────────────
function StatCircle({ value, label, icon, color, size }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  // Per i valori mossa: PP max ~30, danno max ~200, crit max 100
  const maxMap = { pp: 30, danno: 200, crit: 100 };
  const maxVal = maxMap[label] ?? 100;
  const pct = Math.min(1, value / maxVal);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.6"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.28, fontWeight: 700, color: '#fff',
          fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
          textShadow: `0 0 6px ${color}`,
          letterSpacing: '-0.02em',
        }}>{value}</div>
      </div>
      <div style={{
        fontSize: Math.max(8, size * 0.30),
        lineHeight: 1, color,
        filter: `drop-shadow(0 0 3px ${color})`,
      }}>{icon}</div>
    </div>
  );
}

/**
 * CartaMossa — stessa struttura visiva di CartaWaifu.
 * @param {Object}  mossa         - Dati dal catalogo mosse
 * @param {Object}  [datiUtente]  - Dati utente { copie, livello, danno?, danno_critico? }
 * @param {'piccola'|'normale'|'media'|'grande'} [dimensione='normale']
 * @param {Function} [onClick]
 * @param {boolean}  [evidenziato]
 */
export function CartaMossa({ mossa, datiUtente, dimensione = 'normale', onClick, evidenziato = false }) {
  if (!mossa) return null;

  const rarita = mossa.rarita ?? 'comune';
  const rar = RARITA[rarita] ?? RARITA.comune;
  const rb  = RARITY_BORDER[rarita] ?? RARITY_BORDER.comune;
  const tipo = mossa.tipologia ?? 'Arcana';
  const tipoCol = TIPO_COLORS[tipo] ?? TIPO_COLORS.Arcana;

  const livello = datiUtente?.livello ?? mossa.livello ?? 1;
  const dannoEff = datiUtente?.danno ?? mossa.danno ?? 0;
  const critEff  = Math.round((datiUtente?.danno_critico ?? mossa.danno_critico ?? 0.05) * 100);
  const ppVal    = mossa.pp ?? 0;

  const scale = dimensione === 'piccola' ? 0.65 : dimensione === 'media' ? 0.82 : dimensione === 'grande' ? 1.15 : 1;
  const W = Math.round(220 * scale);
  const H = Math.round(330 * scale);
  const borderW = dimensione === 'piccola' ? 2 : 3;
  const statSize = Math.round(30 * scale);

  const imgSrc = (mossa.immagine_url && mossa.immagine_url !== '/images/mosse/placeholder.png')
    ? mossa.immagine_url : null;

  const showFoil = rarita === 'epico' || rarita === 'leggendario' || rarita === 'immersivo';

  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: Math.round(14 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)`
          : `0 0 22px ${rb.glow}, inset 0 0 18px rgba(0,0,0,0.35)`,
        overflow: 'hidden',
        background: rb.bg,
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
    >
      {/* Bordo interno */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(11 * scale),
        border: `1px solid ${rb.inner}3a`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* IMMAGINE / PLACEHOLDER */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: Math.round(12 * scale),
        overflow: 'hidden',
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={mossa.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
        ) : (
          // Placeholder con sfondo tipo mossa + icona grande
          <div style={{
            width: '100%', height: '100%',
            background:
              `radial-gradient(120% 80% at 50% 0%, ${tipoCol.bg}, transparent 55%),
               repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 6px, transparent 6px 14px),
               ${rb.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: Math.round(72 * scale),
              opacity: 0.35,
              filter: `drop-shadow(0 0 ${Math.round(20 * scale)}px ${tipoCol.accent})`,
              lineHeight: 1,
            }}>{tipoCol.icon}</div>
          </div>
        )}

        {/* HOLO FOIL — stesso di CartaWaifu */}
        {showFoil && <div className={`foil ${rarita === 'immersivo' ? 'foil--strong' : ''}`} />}
      </div>

      {/* OVERLAY TOP — nome + livello + stelle */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `${Math.round(9 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
        zIndex: 4,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 6,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
            fontSize: Math.round(13 * scale), fontWeight: 700,
            color: '#fff', letterSpacing: '-0.005em',
            textShadow: `0 0 12px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
            lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{mossa.nome}</div>
          <div style={{
            fontSize: Math.round(8.5 * scale),
            color: rb.inner,
            letterSpacing: '0.22em',
            fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
            marginTop: 3,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            textTransform: 'uppercase',
          }}>Lv.{livello}</div>
          {/* Tag tipo (analogo all'archetipo tag di CartaWaifu) */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: Math.round(4 * scale),
            background: tipoCol.bg,
            border: `1px solid ${tipoCol.accent}66`,
            borderRadius: 999,
            padding: `${Math.round(1.5 * scale)}px ${Math.round(6 * scale)}px`,
          }}>
            <span style={{ fontSize: Math.round(9 * scale), color: tipoCol.accent }}>{tipoCol.icon}</span>
            <span style={{
              fontSize: Math.round(7.5 * scale),
              color: tipoCol.accent,
              fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>{tipo}</span>
          </div>
        </div>
        {/* Stelle rarità */}
        <div style={{ display: 'flex', gap: 1.5, marginTop: 1, flexShrink: 0 }}>
          {[...Array(rar.stelle)].map((_, i) => (
            <span key={i} style={{
              color: rb.inner,
              fontSize: Math.round(11 * scale),
              textShadow: `0 0 6px ${rb.glow}`,
              filter: `drop-shadow(0 0 3px ${rb.inner})`,
            }}>★</span>
          ))}
        </div>
      </div>

      {/* TAG RARITÀ (pill laterale destro) */}
      <div style={{
        position: 'absolute', top: Math.round(46 * scale), right: 0,
        background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
        color: '#000',
        padding: `${Math.round(2.5 * scale)}px ${Math.round(9 * scale)}px`,
        fontSize: Math.round(7.5 * scale),
        fontWeight: 800, letterSpacing: '0.2em',
        fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
        borderRadius: `${Math.round(5 * scale)}px 0 0 ${Math.round(5 * scale)}px`,
        textTransform: 'uppercase',
        boxShadow: `0 2px 12px ${rb.glow}, 0 0 0 1px rgba(255,255,255,0.18) inset`,
        zIndex: 5,
      }}>{rar.nome}</div>

      {/* OVERLAY BOTTOM — 3 stat: PP, Danno, Crit% */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: `${Math.round(22 * scale)}px ${Math.round(8 * scale)}px ${Math.round(9 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        zIndex: 4,
      }}>
        {/* Linea ornamento */}
        <div style={{
          width: '70%', height: 1, margin: `0 auto ${Math.round(7 * scale)}px`,
          background: `linear-gradient(90deg, transparent, ${rb.inner}cc, transparent)`,
          boxShadow: `0 0 6px ${rb.glow}`,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <StatCircle value={ppVal}    label="pp"    icon="⚡" color="#6cf0e0" size={statSize} />
          <StatCircle value={dannoEff} label="danno" icon="⚔" color="#ff9ec6" size={statSize} />
          <StatCircle value={critEff}  label="crit"  icon="✦" color="#ffc861" size={statSize} />
        </div>
      </div>

      {/* CORNER BRACKETS — identici a CartaWaifu */}
      {[
        { top: Math.round(5*scale), left:  Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderLeft:  `1.5px solid ${rb.inner}` }, r: { borderTopLeftRadius:     Math.round(10*scale) } },
        { top: Math.round(5*scale), right: Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` }, r: { borderTopRightRadius:    Math.round(10*scale) } },
        { bottom: Math.round(5*scale), right: Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` }, r: { borderBottomRightRadius: Math.round(10*scale) } },
        { bottom: Math.round(5*scale), left:  Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderLeft:  `1.5px solid ${rb.inner}` }, r: { borderBottomLeftRadius:  Math.round(10*scale) } },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: Math.round(14 * scale), height: Math.round(14 * scale),
          opacity: 0.65, zIndex: 5, pointerEvents: 'none',
          top: c.top, bottom: c.bottom, left: c.left, right: c.right,
          ...c.borders, ...c.r,
        }} />
      ))}
    </div>
  );
}
