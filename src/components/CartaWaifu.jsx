// src/components/CartaWaifu.jsx
// CARTA WAIFU — Stile Digimon full-art con stat circles e bordo colorato per rarità
// La carta è SEPARATA dalla baby-doll: le stats si propagano, gli outfit si modificano solo nella baby-doll
'use client';
import React from 'react';
import { RARITA, COLORI_CAPELLI, CATEGORIE_TETTE } from '@/lib/constants';

// ====================================================================
// COLORI BORDO PER RARITÀ (stile Digimon TCG)
// ====================================================================
const RARITY_BORDER = {
  comune:      { outer: '#7a8694', inner: '#9ca3af', glow: 'rgba(156,163,175,0.35)', bg: 'linear-gradient(160deg, #1a1e24 0%, #0d1015 100%)' },
  raro:        { outer: '#2563eb', inner: '#60a5fa', glow: 'rgba(37,99,235,0.5)',     bg: 'linear-gradient(160deg, #0a1628 0%, #081020 100%)' },
  epico:       { outer: '#9333ea', inner: '#c084fc', glow: 'rgba(147,51,234,0.55)',   bg: 'linear-gradient(160deg, #1a0a30 0%, #100820 100%)' },
  leggendario: { outer: '#f59e0b', inner: '#fbbf24', glow: 'rgba(245,158,11,0.6)',    bg: 'linear-gradient(160deg, #2a1a05 0%, #1a1005 100%)' },
  immersivo:   { outer: '#ec4899', inner: '#f472b6', glow: 'rgba(236,72,153,0.65)',   bg: 'linear-gradient(160deg, #2a0520 0%, #1a0515 100%)' },
};

// ====================================================================
// CERCHI STAT (stile Digimon/gacha card)
// ====================================================================
function StatCircle({ value, label, icon, color, size = 34 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const maxVal = label === 'Piedi' ? 44 : label === 'Età' ? 100 : label === 'Exp' ? 250 : label === 'Capelli' ? 10 : 7;
  const pct = Math.min(1, value / maxVal);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.32, fontWeight: 700, color: '#fff',
          fontFamily: 'Orbitron, monospace',
          textShadow: `0 0 6px ${color}`,
        }}>{value}</div>
      </div>
      <div style={{ fontSize: 7, letterSpacing: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontFamily: 'Orbitron, sans-serif' }}>{label}</div>
    </div>
  );
}

// ====================================================================
// CARTA WAIFU PRINCIPALE — Full-art Digimon style
// ====================================================================
export function CartaWaifu({ waifu, datiCollezione, dimensione = 'normale', onClick, evidenziato = false, tipo = 'auto', outfitCatalogo = [], poseCatalogo = [], equip }) {
  if (!waifu) return null;
  const rar = RARITA[waifu.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[waifu.rarita] || RARITY_BORDER.comune;

  let usaImmersiva = false;
  if (tipo === 'immersiva') usaImmersiva = true;
  if (tipo === 'auto' && (waifu.rarita === 'leggendario' || waifu.rarita === 'immersivo') && waifu.asset_immersiva) {
    usaImmersiva = true;
  }

  const scale = dimensione === 'piccola' ? 0.65 : dimensione === 'grande' ? 1.15 : 1;
  const W = Math.round(220 * scale);
  const H = Math.round(330 * scale);
  const borderW = dimensione === 'piccola' ? 2 : 3;

  // Stat effettive (bonus da level up si propagano dalla baby-doll alla carta)
  // CODICE LINK CARTA -> BABY DOLL: le stats della carta leggono i bonus applicati nella baby-doll
  const statBonus = datiCollezione?.stat_bonus || {};
  const tetteEff = Math.min(7, (waifu.tette || 3) + (statBonus.tette || 0));
  const piediEff = (waifu.taglia_piedi || 38) + (statBonus.taglia_piedi || 0);
  const etaEff = (waifu.eta || 20) + (statBonus.eta || 0);
  const capelliEff = Math.min(10, (waifu.colore_capelli || 1) + (statBonus.colore_capelli || 0));
  const expEff = (waifu.esperienza || 50) + (statBonus.esperienza || 0);

  const imgSrc = usaImmersiva ? waifu.asset_immersiva : (waifu.asset_statica || null);
  const statSize = Math.round(34 * scale);

  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H,
        position: 'relative',
        borderRadius: Math.round(12 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffd666' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,214,102,0.6), inset 0 0 20px rgba(255,214,102,0.1)`
          : `0 0 20px ${rb.glow}, inset 0 0 15px rgba(0,0,0,0.4)`,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        background: rb.bg,
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
    >
      {/* --- BORDO INTERNO LUMINOSO (Digimon style) --- */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(9 * scale),
        border: `1px solid ${rb.inner}30`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* --- IMMAGINE FULL-ART --- */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: Math.round(10 * scale),
        overflow: 'hidden',
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={waifu.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
          />
        ) : (
          /* Fallback: sfondo decorativo con pattern */
          <div style={{
            width: '100%', height: '100%',
            background: `radial-gradient(ellipse at 50% 30%, ${rb.inner}30, transparent 70%), ${rb.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: Math.round(80 * scale), opacity: 0.15, color: rb.inner,
              fontFamily: 'Cinzel, serif',
            }}>♛</span>
          </div>
        )}
      </div>

      {/* --- OVERLAY GRADIENTE TOP (nome + rarità) --- */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        zIndex: 4,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: Math.round(13 * scale), fontWeight: 700,
            color: '#fff', letterSpacing: 1,
            textShadow: `0 0 10px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.8)`,
            lineHeight: 1.2,
          }}>{waifu.nome}</div>
          {datiCollezione && (
            <div style={{
              fontSize: Math.round(8 * scale), color: rb.inner, letterSpacing: 2,
              fontFamily: 'Orbitron, sans-serif', marginTop: 2,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}>LV.{datiCollezione.livello || 1}</div>
          )}
        </div>
        {/* Stelle rarità */}
        <div style={{ display: 'flex', gap: 1, marginTop: 2 }}>
          {[...Array(rar.stelle)].map((_, i) => (
            <span key={i} style={{
              color: rb.inner, fontSize: Math.round(11 * scale),
              textShadow: `0 0 6px ${rb.glow}`,
            }}>★</span>
          ))}
        </div>
      </div>

      {/* --- TAG RARITÀ (angolo) --- */}
      <div style={{
        position: 'absolute', top: Math.round(40 * scale), right: 0,
        background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
        color: '#000', padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
        fontSize: Math.round(7 * scale), fontWeight: 800, letterSpacing: 2,
        fontFamily: 'Orbitron, sans-serif',
        borderRadius: `${Math.round(4 * scale)}px 0 0 ${Math.round(4 * scale)}px`,
        textTransform: 'uppercase',
        boxShadow: `0 2px 8px ${rb.glow}`,
        zIndex: 5,
      }}>
        {rar.nome}
      </div>

      {/* --- OVERLAY GRADIENTE BOTTOM (stats) --- */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: `${Math.round(24 * scale)}px ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
        zIndex: 4,
      }}>
        {/* Linea decorativa */}
        <div style={{
          width: '60%', height: 1, margin: `0 auto ${Math.round(6 * scale)}px`,
          background: `linear-gradient(90deg, transparent, ${rb.inner}, transparent)`,
        }} />

        {/* STAT CIRCLES — stile Digimon */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <StatCircle value={tetteEff} label={CATEGORIE_TETTE[tetteEff]?.substring(0,3) || 'Med'} icon="✦" color="#ff6b9d" size={statSize} />
          <StatCircle value={piediEff} label="Piedi" icon="⚘" color="#64b5f6" size={statSize} />
          <StatCircle value={etaEff} label="Età" icon="⌛" color="#ffd54f" size={statSize} />
          <StatCircle value={capelliEff} label="Cap" icon="✿" color="#81c784" size={statSize} />
          <StatCircle value={expEff} label="Exp" icon="★" color="#ce93d8" size={statSize} />
        </div>
      </div>

      {/* --- EFFETTO ANGOLI DIGIMON --- */}
      {[
        { top: Math.round(4*scale), left: Math.round(4*scale), r: 0 },
        { top: Math.round(4*scale), right: Math.round(4*scale), r: 90 },
        { bottom: Math.round(4*scale), right: Math.round(4*scale), r: 180 },
        { bottom: Math.round(4*scale), left: Math.round(4*scale), r: 270 },
      ].map((c, i) => (
        <svg key={i} viewBox="0 0 16 16" width={Math.round(12*scale)} height={Math.round(12*scale)}
          style={{ position: 'absolute', transform: `rotate(${c.r}deg)`, zIndex: 5, ...c }}>
          <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" fill={rb.inner} opacity="0.7" />
        </svg>
      ))}

      {/* --- COPIE BADGE --- */}
      {datiCollezione && datiCollezione.copie > 1 && (
        <div style={{
          position: 'absolute', bottom: Math.round(8*scale), right: Math.round(8*scale),
          background: 'rgba(0,0,0,0.8)', border: `1px solid ${rb.inner}`,
          color: rb.inner, fontSize: Math.round(9*scale), fontWeight: 700,
          padding: `${Math.round(2*scale)}px ${Math.round(6*scale)}px`,
          borderRadius: Math.round(6*scale),
          fontFamily: 'Orbitron, sans-serif', letterSpacing: 1,
          zIndex: 6,
        }}>×{datiCollezione.copie}</div>
      )}
    </div>
  );
}

// ====================================================================
// CARTA OUTFIT — Compatta con bordo rarità
// ====================================================================
export function CartaOutfit({ outfit, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[outfit.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[outfit.rarita] || RARITY_BORDER.comune;
  const slotIcons = { faccia: '👁', petto: '✦', gambe: '⚘', piedi: '◈' };
  return (
    <div onClick={onClick} style={{
      width: 120, padding: 10,
      background: rb.bg,
      border: `2px solid ${evidenziato ? '#ffd666' : rb.outer}`,
      borderRadius: 10,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.25s',
      position: 'relative',
      boxShadow: `0 0 12px ${rb.glow}`,
    }}>
      {quantita > 1 && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.8)', color: rb.inner, fontSize: 9, padding: '2px 6px', borderRadius: 8, border: `1px solid ${rb.inner}`, fontFamily: 'Orbitron' }}>×{quantita}</div>
      )}
      <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {outfit.asset ? (
          <img src={outfit.asset} alt={outfit.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 32, filter: `drop-shadow(0 0 6px ${rb.glow})` }}>{slotIcons[outfit.slot] || '?'}</div>
        )}
      </div>
      <div style={{ fontFamily: 'Fredoka', fontSize: 10, textAlign: 'center', color: '#fff', marginBottom: 4, minHeight: 26, lineHeight: 1.3 }}>{outfit.nome}</div>
      <div style={{ textAlign: 'center' }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: 9 }}>★</span>
        ))}
      </div>
    </div>
  );
}

// ====================================================================
// CARTA POSA
// ====================================================================
export function CartaPosa({ posa, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[posa.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[posa.rarita] || RARITY_BORDER.comune;
  return (
    <div onClick={onClick} style={{
      width: 120, padding: 10,
      background: rb.bg,
      border: `2px solid ${evidenziato ? '#ffd666' : rb.outer}`,
      borderRadius: 10,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.25s',
      position: 'relative',
      boxShadow: `0 0 12px ${rb.glow}`,
    }}>
      {quantita > 1 && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.8)', color: rb.inner, fontSize: 9, padding: '2px 6px', borderRadius: 8, border: `1px solid ${rb.inner}`, fontFamily: 'Orbitron' }}>×{quantita}</div>
      )}
      <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {posa.asset ? (
          <img src={posa.asset} alt={posa.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 32, filter: `drop-shadow(0 0 6px ${rb.glow})` }}>⚜</div>
        )}
      </div>
      <div style={{ fontFamily: 'Fredoka', fontSize: 10, textAlign: 'center', color: '#fff', marginBottom: 4, minHeight: 26, lineHeight: 1.3 }}>{posa.nome}</div>
      <div style={{ fontSize: 8, opacity: 0.5, textAlign: 'center', marginBottom: 4 }}>
        {posa.waifu_id ? `Waifu: ${posa.waifu_id}` : 'Universale'}
      </div>
      <div style={{ textAlign: 'center' }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: 9 }}>★</span>
        ))}
      </div>
    </div>
  );
}
