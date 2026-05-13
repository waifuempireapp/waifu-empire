// src/components/CartaWaifu.jsx
// FASE 4 — Grafica Carte
//   • Waifu: simbolo archetipo sotto nome/livello
//   • Immersive: Pokémon Pocket — statica → click → video dentro carta → fine/click → torna statica
//   • Outfit: stile waifu full-art, immagine dal nome, archetipo compatibile, abilità
//   • Posa: placeholder silhouette grigio per slot posa, preview waifu associata
'use client';
import React, { useState } from 'react';
import { RARITA } from '@/lib/constants';
import { ARCHETIPI } from '@/lib/promptGenerator';

// Mappa id→archetipo per lookup rapido
const ARCHETIPI_MAP = {};
if (ARCHETIPI) ARCHETIPI.forEach(a => { ARCHETIPI_MAP[a.id] = a; });

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
// SIMBOLI ARCHETIPO — ogni archetipo ha un simbolo SVG/testo unico
// ====================================================================
const ARCHETIPO_SIMBOLI = {
  guerriera_stoica:    { sym: '⚔',  color: '#e74c3c' },
  maga_timida:         { sym: '✦',  color: '#a855f7' },
  regina_imperiosa:    { sym: '♛',  color: '#f59e0b' },
  studiosa_pensosa:    { sym: '🔭', color: '#3b82f6' },
  viaggiatrice_solare: { sym: '☀',  color: '#f97316' },
  idol_radiante:       { sym: '★',  color: '#ec4899' },
  sacerdotessa_etera:  { sym: '⛩',  color: '#06b6d4' },
  spadaccina_audace:   { sym: '⚡',  color: '#eab308' },
  principessa_drago:   { sym: '🐉', color: '#dc2626' },
  ladra_furtiva:       { sym: '◈',  color: '#14b8a6' },
  oracolo_mistico:     { sym: '◉',  color: '#8b5cf6' },
  pirata_temeraria:    { sym: '☠',  color: '#64748b' },
  fata_giocosa:        { sym: '✿',  color: '#84cc16' },
  ninja_letale:        { sym: '◆',  color: '#1e293b' },
  dea_celestiale:      { sym: '☽',  color: '#fde68a' },
  cyber_hacker:        { sym: '⌘',  color: '#22d3ee' },
  tsundere_classica:   { sym: '❤',  color: '#f43f5e' },
  demone_seducente:    { sym: '♦',  color: '#9f1239' },
  sciamana_natura:     { sym: '🌿', color: '#22c55e' },
  samurai_onorata:     { sym: '⛧',  color: '#78716c' },
};

function getArchetipoSym(archetipoId, rarColor) {
  return ARCHETIPO_SIMBOLI[archetipoId] || { sym: '◈', color: rarColor };
}

// ====================================================================
// CERCHI STAT (stile Digimon/gacha card)
// ====================================================================
function StatCircle({ value, statKey, icon, color, size = 34 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const maxVal = statKey === 'piedi' ? 45 : statKey === 'eta' ? 5000 : statKey === 'exp' ? 5000 : statKey === 'capelli' ? 10 : 7;
  const pct = Math.min(1, value / maxVal);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
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
      <div style={{
        fontSize: size * 0.32,
        lineHeight: 1,
        filter: `drop-shadow(0 0 3px ${color})`,
        transform: statKey === 'tette' ? 'rotate(180deg)' : 'none',
      }}>{icon}</div>
    </div>
  );
}

// ====================================================================
// SIMBOLO ARCHETIPO — cerchio decorativo sotto nome/livello
// ====================================================================
function ArchetipoTag({ archetipoId, rarColor, scale = 1 }) {
  const sym = getArchetipoSym(archetipoId, rarColor);
  const sz = Math.round(28 * scale);

  if (!archetipoId) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      marginTop: Math.round(4 * scale),
    }}>
      {/* Solo cerchio simbolo — nessun nome */}
      <div style={{
        width: sz, height: sz,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 40%, ${sym.color}33, rgba(0,0,0,0.7))`,
        border: `1.5px solid ${sym.color}88`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(sz * 0.42),
        boxShadow: `0 0 6px ${sym.color}55`,
        flexShrink: 0,
      }}>
        {sym.sym}
      </div>
    </div>
  );
}

// ====================================================================
// CARTA WAIFU PRINCIPALE — Full-art Digimon/Pokémon Pocket style
// Fase 4: simbolo archetipo + modalità immersiva con video
// ====================================================================
// videoAttivo e videoRef sono ora gestiti esternamente (dalla CartaImmersiva nel modale).
// CartaWaifu riceve videoAttivo (bool) e videoRef come prop opzionali per il solo rendering.
export function CartaWaifu({ waifu, datiCollezione, dimensione = 'normale', onClick, evidenziato = false, tipo = 'auto', outfitCatalogo = [], poseCatalogo = [], equip, videoAttivo = false, videoRef = null, onVideoEnd, isHot = false, censurata = false }) {
  const [videoFinito, setVideoFinito] = useState(false);

  if (!waifu) return null;
  const rar = RARITA[waifu.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[waifu.rarita] || RARITY_BORDER.comune;

  const hasVideo = !!(waifu.asset_video);
  let usaImmersiva = false;
  if (tipo === 'immersiva') usaImmersiva = true;
  if (tipo === 'auto' && (waifu.rarita === 'leggendario' || waifu.rarita === 'immersivo') && waifu.asset_immersiva) {
    usaImmersiva = true;
  }

  const scale = dimensione === 'piccola' ? 0.65 : dimensione === 'grande' ? 1.15 : 1;
  const W = Math.round(220 * scale);
  const H = Math.round(330 * scale);
  const borderW = dimensione === 'piccola' ? 2 : 3;

  const statBonus = datiCollezione?.stat_bonus || {};
  const tetteEff = Math.min(7, (waifu.tette ?? 3) + (statBonus.tette || 0));
  const piediEff = (waifu.taglia_piedi ?? 38) + (statBonus.taglia_piedi || 0);
  const etaEff = (waifu.eta ?? 18) + (statBonus.eta || 0);
  const capelliEff = Math.min(10, (waifu.colore_capelli ?? 1) + (statBonus.colore_capelli || 0));
  const expEff = (waifu.esperienza ?? 0) + (statBonus.esperienza || 0);

  const imgSrc = usaImmersiva ? waifu.asset_immersiva : (waifu.asset_statica || null);
  const statSize = Math.round(34 * scale);

  // Click sulla carta: va sempre all'onClick esterno (il video non parte dal click sulla carta)
  const handleClick = () => {
    onClick?.();
  };

  const handleVideoEnd = () => {
    setVideoFinito(true);
    onVideoEnd?.();
  };



  return (
    <div
      onClick={handleClick}
      style={{
        width: W, height: H,
        position: 'relative',
        borderRadius: Math.round(12 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffd666' : videoAttivo ? '#ec4899' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,214,102,0.6), inset 0 0 20px rgba(255,214,102,0.1)`
          : videoAttivo
            ? `0 0 35px rgba(236,72,153,0.8), inset 0 0 20px rgba(236,72,153,0.15)`
            : `0 0 20px ${rb.glow}, inset 0 0 15px rgba(0,0,0,0.4)`,
        cursor: (onClick || hasVideo) ? 'pointer' : 'default',
        overflow: 'hidden',
        background: rb.bg,
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => (onClick || hasVideo) && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
      onMouseLeave={(e) => (onClick || hasVideo) && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
    >
      {/* --- BORDO INTERNO LUMINOSO --- */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(9 * scale),
        border: `1px solid ${rb.inner}30`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* --- IMMAGINE STATICA --- */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: Math.round(10 * scale),
        overflow: 'hidden',
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        {censurata ? (
          /* Modalità censurata: immagine blurrata + overlay lucchetto (carta Hot senza Pass Hard) */
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {imgSrc && <img src={imgSrc} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', filter: 'blur(14px) brightness(0.3)' }} />}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: Math.round(32 * scale), filter: 'drop-shadow(0 0 8px rgba(255,69,0,0.8))' }}>🔒</span>
              <div style={{ fontFamily: 'Orbitron', fontSize: Math.max(6, Math.round(7 * scale)), color: 'rgba(238,232,220,0.7)', letterSpacing: 1, textAlign: 'center', lineHeight: 1.4 }}>Pass Hard{'\n'}richiesto</div>
              <button
                onClick={e => { e.stopPropagation(); window.dispatchEvent(new Event('impero:apri-negozio')); }}
                style={{ marginTop: 4, background: 'rgba(255,69,0,0.2)', border: '1px solid rgba(255,69,0,0.5)', borderRadius: 6, color: '#ff8c00', fontFamily: 'Orbitron', fontSize: Math.max(5, Math.round(6 * scale)), padding: '3px 8px', cursor: 'pointer' }}
              >SBLOCCA</button>
            </div>
          </div>
        ) : imgSrc ? (
          <img src={imgSrc} alt={waifu.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `radial-gradient(ellipse at 50% 30%, ${rb.inner}30, transparent 70%), ${rb.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: Math.round(80 * scale), opacity: 0.15, color: rb.inner, fontFamily: 'Cinzel, serif' }}>♛</span>
          </div>
        )}

        {/* Badge HOT 🔥 — solo se isHot e non censurata */}
        {isHot && !censurata && (
          <div style={{
            position: 'absolute', top: Math.round(6 * scale), left: Math.round(6 * scale),
            background: 'linear-gradient(135deg, #ff4500cc, #ff8c00cc)',
            color: '#fff', fontFamily: 'Orbitron, monospace',
            fontSize: Math.max(5, Math.round(7 * scale)), fontWeight: 900, letterSpacing: 0.5,
            padding: `${Math.round(2 * scale)}px ${Math.round(5 * scale)}px`, borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.35)', boxShadow: '0 0 8px rgba(255,69,0,0.6)',
            pointerEvents: 'none', zIndex: 12, textTransform: 'uppercase',
          }}>HOT 🔥</div>
        )}
      </div>

      {/* --- VIDEO IMMERSIVO (Pokémon Pocket style) --- */}
      {hasVideo && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: Math.round(10 * scale),
          overflow: 'hidden',
          opacity: videoAttivo ? 1 : 0,
          transition: 'opacity 0.35s ease',
          zIndex: videoAttivo ? 10 : 0,
          pointerEvents: videoAttivo ? 'auto' : 'none',
        }}>
          <video
            ref={videoRef}
            src={waifu.asset_video}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
            onEnded={handleVideoEnd}
            muted
            playsInline
          />
          {/* Overlay fine video */}
          {videoFinito && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{
                color: '#fff', fontFamily: 'Orbitron, monospace',
                fontSize: Math.round(10 * scale), opacity: 0.8, letterSpacing: 2,
              }}>◀ RIVEDI</div>
            </div>
          )}
        </div>
      )}

      {/* --- OVERLAY TOP (nome + livello + archetipo) — nascosto durante video --- */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
        zIndex: videoAttivo ? 0 : 4,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
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
          {/* ★ FASE 4: Simbolo archetipo sotto nome/livello — visibile sempre */}
          {waifu.archetipo && (
            <ArchetipoTag archetipoId={waifu.archetipo} rarColor={rb.inner} scale={scale} />
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

      {/* --- TAG RARITÀ (angolo) — nascosto durante video --- */}
      <div style={{
        position: 'absolute', top: Math.round(40 * scale), right: 0,
        background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
        color: '#000', padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
        fontSize: Math.round(7 * scale), fontWeight: 800, letterSpacing: 2,
        fontFamily: 'Orbitron, sans-serif',
        borderRadius: `${Math.round(4 * scale)}px 0 0 ${Math.round(4 * scale)}px`,
        textTransform: 'uppercase',
        boxShadow: `0 2px 8px ${rb.glow}`,
        zIndex: videoAttivo ? 0 : 5,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        {rar.nome}
      </div>

      {/* --- OVERLAY BOTTOM (stats) — nascosto durante video --- */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: `${Math.round(20 * scale)}px ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)',
        zIndex: videoAttivo ? 0 : 4,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        <div style={{
          width: '60%', height: 1, margin: `0 auto ${Math.round(6 * scale)}px`,
          background: `linear-gradient(90deg, transparent, ${rb.inner}, transparent)`,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <StatCircle value={tetteEff} statKey="tette" icon="💗" color="#ff6b9d" size={statSize} />
          <StatCircle value={piediEff} statKey="piedi" icon="🦶" color="#64b5f6" size={statSize} />
          <StatCircle value={etaEff} statKey="eta" icon="⏳" color="#ffd54f" size={statSize} />
          <StatCircle value={capelliEff} statKey="capelli" icon="💇" color="#81c784" size={statSize} />
          <StatCircle value={expEff} statKey="exp" icon="⭐" color="#ce93d8" size={statSize} />
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
      {datiCollezione && datiCollezione.copie > 1 && !videoAttivo && (
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
// CARTA OUTFIT — Stile waifu full-art
// Fase 4: immagine generata, archetipo compatibile, abilità
// ====================================================================

// Genera colore di sfondo per l'outfit basato sul slot
const SLOT_BG = {
  faccia: 'linear-gradient(160deg, #0a1828 0%, #060f1a 100%)',
  petto:  'linear-gradient(160deg, #1a0a20 0%, #100516 100%)',
  gambe:  'linear-gradient(160deg, #0a1a10 0%, #060e08 100%)',
  piedi:  'linear-gradient(160deg, #1a1505 0%, #0f0e03 100%)',
};
const SLOT_COLORS = {
  faccia: { primary: '#60a5fa', glow: 'rgba(96,165,250,0.5)' },
  petto:  { primary: '#c084fc', glow: 'rgba(192,132,252,0.5)' },
  gambe:  { primary: '#4ade80', glow: 'rgba(74,222,128,0.5)' },
  piedi:  { primary: '#fb923c', glow: 'rgba(251,146,60,0.5)' },
};
const SLOT_ICONS = { faccia: '👁', petto: '✦', gambe: '⚘', piedi: '◈' };

// Icone abilità outfit
const ABILITA_ICONS = {
  stat_up:    '↑',
  stat_down:  '↓',
  opp_up:     '⬆',
  opp_down:   '⬇',
  reuse_stat: '↺',
  reuse_waifu:'♻',
};

function AbilitaTag({ abilita, color, scale = 1 }) {
  if (!abilita || !abilita.tipo) return null;
  const icon = ABILITA_ICONS[abilita.tipo] || '◈';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: Math.round(3 * scale),
      background: `rgba(0,0,0,0.7)`,
      border: `1px solid ${color}55`,
      borderRadius: Math.round(4 * scale),
      padding: `${Math.round(2 * scale)}px ${Math.round(5 * scale)}px`,
      marginTop: Math.round(3 * scale),
    }}>
      <span style={{ color: color, fontSize: Math.round(9 * scale), fontWeight: 700 }}>{icon}</span>
      <span style={{
        color: '#ddd', fontSize: Math.round(7.5 * scale),
        fontFamily: 'Orbitron, monospace', letterSpacing: 0.5,
        maxWidth: Math.round(90 * scale), overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{abilita.descrizione || abilita.tipo}</span>
    </div>
  );
}

// Placeholder immagine outfit: SVG generato dal nome (primo carattere + colore slot)
function OutfitImagePlaceholder({ nome, slot, colore, scale = 1, asset }) {
  const sc = SLOT_COLORS[slot] || SLOT_COLORS.petto;
  const bg = SLOT_BG[slot] || SLOT_BG.petto;
  const icon = SLOT_ICONS[slot] || '✦';
  const W = Math.round(220 * scale);
  const H = Math.round(200 * scale); // area immagine ~60% della carta

  if (asset) {
    return (
      <img src={asset} alt={nome}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }}
      />
    );
  }

  // Generative placeholder: grande icona slot + iniziale nome
  const iniziale = (nome || '?')[0].toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontSize: Math.round(52 * scale), opacity: 0.25,
        filter: `drop-shadow(0 0 12px ${sc.primary})`,
        color: sc.primary,
        fontFamily: 'Cinzel, serif',
      }}>{icon}</div>
      <div style={{
        fontSize: Math.round(22 * scale), fontWeight: 900, color: sc.primary,
        opacity: 0.5, fontFamily: 'Orbitron, monospace',
        textShadow: `0 0 10px ${sc.primary}`,
      }}>{iniziale}</div>
    </div>
  );
}

export function CartaOutfit({ outfit, quantita = 1, onClick, evidenziato = false, dimensione = 'normale' }) {
  const rar = RARITA[outfit.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[outfit.rarita] || RARITY_BORDER.comune;
  const sc = SLOT_COLORS[outfit.slot] || SLOT_COLORS.petto;
  const isComune = outfit.rarita === 'comune';

  const scale = dimensione === 'piccola' ? 0.65 : dimensione === 'grande' ? 1.15 : 1;
  const W = Math.round(220 * scale);
  const H = Math.round(330 * scale);
  const borderW = dimensione === 'piccola' ? 2 : 3;

  const archetipoSym = outfit.archetipo_compatibile
    ? getArchetipoSym(outfit.archetipo_compatibile, sc.primary)
    : null;
  const archetipoNome = outfit.archetipo_compatibile
    ? (ARCHETIPI_MAP[outfit.archetipo_compatibile]?.nome || outfit.archetipo_compatibile.replace(/_/g, ' '))
    : null;

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
      {/* Bordo interno */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(9 * scale),
        border: `1px solid ${rb.inner}30`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* --- AREA IMMAGINE FULL-ART (60% alto) --- */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '63%',
        overflow: 'hidden',
        borderRadius: `${Math.round(10 * scale)}px ${Math.round(10 * scale)}px 0 0`,
      }}>
        <OutfitImagePlaceholder nome={outfit.nome} slot={outfit.slot} colore={outfit.colore} scale={scale} asset={outfit.asset} />
        {/* Overlay gradiente basso per fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '40%',
          background: `linear-gradient(0deg, ${rb.bg.includes('#2a0520') ? '#2a0520' : '#0d1015'} 0%, transparent 100%)`,
        }} />
      </div>

      {/* --- TAG SLOT (angolo in alto a sinistra) --- */}
      <div style={{
        position: 'absolute', top: Math.round(8 * scale), left: Math.round(8 * scale),
        background: `rgba(0,0,0,0.75)`,
        border: `1px solid ${sc.primary}66`,
        borderRadius: Math.round(6 * scale),
        padding: `${Math.round(2 * scale)}px ${Math.round(7 * scale)}px`,
        display: 'flex', alignItems: 'center', gap: Math.round(3 * scale),
        zIndex: 5,
      }}>
        <span style={{ fontSize: Math.round(10 * scale) }}>{SLOT_ICONS[outfit.slot] || '?'}</span>
        <span style={{
          fontSize: Math.round(7 * scale), color: sc.primary,
          fontFamily: 'Orbitron, monospace', letterSpacing: 1, textTransform: 'uppercase',
        }}>{outfit.slot || 'slot'}</span>
      </div>

      {/* --- TAG RARITÀ (angolo in alto a destra) --- */}
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
      }}>{rar.nome}</div>

      {/* --- STELLE RARITÀ (angolo superiore destro) --- */}
      <div style={{
        position: 'absolute', top: Math.round(8 * scale), right: Math.round(8 * scale),
        display: 'flex', gap: 1, zIndex: 5,
      }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: Math.round(10 * scale), textShadow: `0 0 6px ${rb.glow}` }}>★</span>
        ))}
      </div>

      {/* --- AREA INFO INFERIORE (37% basso) --- */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '37%',
        padding: `${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        zIndex: 4,
      }}>
        {/* Linea decorativa */}
        <div style={{
          width: '80%', height: 1, marginBottom: Math.round(6 * scale),
          background: `linear-gradient(90deg, transparent, ${sc.primary}88, transparent)`,
        }} />

        {/* Nome outfit */}
        <div style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: Math.round(11 * scale), fontWeight: 700,
          color: '#fff', letterSpacing: 0.5, lineHeight: 1.2,
          marginBottom: Math.round(4 * scale),
          textShadow: `0 0 8px ${sc.glow}, 0 2px 4px rgba(0,0,0,0.8)`,
        }}>{outfit.nome}</div>

        {/* ★ FASE 4: Archetipo compatibile — senza usare parola "archetipo" */}
        {archetipoSym && archetipoNome && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: Math.round(4 * scale),
            marginBottom: Math.round(4 * scale),
          }}>
            <div style={{
              width: Math.round(18 * scale), height: Math.round(18 * scale),
              borderRadius: '50%',
              background: `radial-gradient(circle, ${archetipoSym.color}33, rgba(0,0,0,0.5))`,
              border: `1px solid ${archetipoSym.color}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.round(9 * scale),
              flexShrink: 0,
            }}>{archetipoSym.sym}</div>
            <span style={{
              fontSize: Math.round(7.5 * scale), color: archetipoSym.color,
              fontFamily: 'Orbitron, monospace', letterSpacing: 0.5,
              opacity: 0.85, textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: Math.round(100 * scale),
            }}>{archetipoNome}</span>
          </div>
        )}

        {/* ★ FASE 4: Abilità outfit (solo rarità non comune) */}
        {!isComune && outfit.abilita && (
          <AbilitaTag abilita={outfit.abilita} color={sc.primary} scale={scale} />
        )}
      </div>

      {/* Copie badge */}
      {quantita > 1 && (
        <div style={{
          position: 'absolute', top: Math.round(8 * scale), left: Math.round(8 * scale),
          background: 'rgba(0,0,0,0.85)', border: `1px solid ${rb.inner}`,
          color: rb.inner, fontSize: Math.round(8 * scale), fontWeight: 700,
          padding: `${Math.round(2 * scale)}px ${Math.round(5 * scale)}px`,
          borderRadius: Math.round(5 * scale), fontFamily: 'Orbitron, sans-serif',
          zIndex: 7,
        }}>×{quantita}</div>
      )}

      {/* Angoli decorativi */}
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
    </div>
  );
}

// ====================================================================
// CARTA POSA — Fase 4: placeholder silhouette variabile per posa
//   + preview waifu associata (piccola anteprima faccia o nome)
// ====================================================================

// Silhouette SVG per posa: forme diverse per tipo posa
const POSA_SILHOUETTES = {
  default: (color) => (
    <svg viewBox="0 0 80 120" style={{ width: '60%', height: '70%', opacity: 0.18 }}>
      {/* Testa */}
      <ellipse cx="40" cy="18" rx="12" ry="13" fill={color} />
      {/* Corpo */}
      <path d="M28,31 Q40,28 52,31 L56,75 Q40,80 24,75 Z" fill={color} />
      {/* Gambe */}
      <rect x="28" y="73" width="10" height="35" rx="4" fill={color} />
      <rect x="42" y="73" width="10" height="35" rx="4" fill={color} />
      {/* Braccia */}
      <rect x="13" y="32" width="9" height="30" rx="4" fill={color} transform="rotate(-8,17,32)" />
      <rect x="58" y="32" width="9" height="30" rx="4" fill={color} transform="rotate(8,63,32)" />
    </svg>
  ),
  seduta: (color) => (
    <svg viewBox="0 0 80 100" style={{ width: '60%', height: '60%', opacity: 0.18 }}>
      <ellipse cx="40" cy="14" rx="11" ry="12" fill={color} />
      <path d="M30,26 Q40,23 50,26 L52,58 Q40,62 28,58 Z" fill={color} />
      {/* Gambe in avanti */}
      <rect x="26" y="57" width="10" height="28" rx="4" fill={color} transform="rotate(15,31,57)" />
      <rect x="42" y="57" width="10" height="28" rx="4" fill={color} transform="rotate(-15,47,57)" />
    </svg>
  ),
  combattimento: (color) => (
    <svg viewBox="0 0 80 120" style={{ width: '60%', height: '70%', opacity: 0.18 }}>
      <ellipse cx="38" cy="16" rx="11" ry="12" fill={color} />
      <path d="M26,28 Q38,24 52,28 L56,72 Q38,77 24,72 Z" fill={color} transform="rotate(-5,38,50)" />
      <rect x="10" y="28" width="9" height="34" rx="4" fill={color} transform="rotate(-35,14,28)" />
      <rect x="58" y="28" width="9" height="34" rx="4" fill={color} transform="rotate(70,63,28)" />
      <rect x="26" y="71" width="10" height="36" rx="4" fill={color} transform="rotate(-10,31,71)" />
      <rect x="43" y="71" width="10" height="32" rx="4" fill={color} transform="rotate(25,48,71)" />
    </svg>
  ),
};

function PosaSilhouette({ tipoPosa, rarColor, scale = 1 }) {
  const tipo = tipoPosa?.toLowerCase().includes('sedut') ? 'seduta'
    : tipoPosa?.toLowerCase().includes('combatt') ? 'combattimento'
    : 'default';
  const SvgFn = POSA_SILHOUETTES[tipo] || POSA_SILHOUETTES.default;
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 35%, ${rarColor}15, transparent 70%)`,
    }}>
      {SvgFn(rarColor)}
    </div>
  );
}

export function CartaPosa({ posa, quantita = 1, onClick, evidenziato = false, waifuPreview = null, dimensione = 'normale' }) {
  const rar = RARITA[posa.rarita] || RARITA.comune;
  const rb = RARITY_BORDER[posa.rarita] || RARITY_BORDER.comune;

  const scale = dimensione === 'piccola' ? 0.65 : dimensione === 'grande' ? 1.15 : 1;
  const W = Math.round(220 * scale);
  const H = Math.round(330 * scale);
  const borderW = dimensione === 'piccola' ? 2 : 3;

  // Colore grigio-chiaro per silhouette (stile placeholder gacha)
  const silColor = '#b0bec5';

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
      {/* Bordo interno */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(9 * scale),
        border: `1px solid ${rb.inner}30`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* --- AREA SILHOUETTE POSA (63% alto) --- */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '63%',
        overflow: 'hidden',
        borderRadius: `${Math.round(10 * scale)}px ${Math.round(10 * scale)}px 0 0`,
      }}>
        {posa.asset ? (
          <img src={posa.asset} alt={posa.nome}
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }}
          />
        ) : (
          <PosaSilhouette tipoPosa={posa.fillers?.tipo || posa.nome} rarColor={silColor} scale={scale} />
        )}
        {/* Overlay fade basso */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
          background: `linear-gradient(0deg, #0d1015 0%, transparent 100%)`,
        }} />
      </div>

      {/* TAG RARITÀ */}
      <div style={{
        position: 'absolute', top: Math.round(8 * scale), right: 0,
        background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
        color: '#000', padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
        fontSize: Math.round(7 * scale), fontWeight: 800, letterSpacing: 2,
        fontFamily: 'Orbitron, sans-serif',
        borderRadius: `${Math.round(4 * scale)}px 0 0 ${Math.round(4 * scale)}px`,
        textTransform: 'uppercase',
        boxShadow: `0 2px 8px ${rb.glow}`,
        zIndex: 5,
      }}>{rar.nome}</div>

      {/* STELLE */}
      <div style={{
        position: 'absolute', top: Math.round(8 * scale), left: Math.round(8 * scale),
        display: 'flex', gap: 1, zIndex: 5,
      }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: Math.round(10 * scale), textShadow: `0 0 6px ${rb.glow}` }}>★</span>
        ))}
      </div>

      {/* --- AREA INFO INFERIORE --- */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '37%',
        padding: `${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        zIndex: 4,
      }}>
        {/* Linea decorativa */}
        <div style={{
          width: '80%', height: 1, marginBottom: Math.round(6 * scale),
          background: `linear-gradient(90deg, transparent, ${rb.inner}88, transparent)`,
        }} />

        {/* Icona posa + Nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(5 * scale), marginBottom: Math.round(4 * scale) }}>
          <span style={{ fontSize: Math.round(14 * scale), filter: `drop-shadow(0 0 4px ${rb.glow})` }}>⚜</span>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: Math.round(11 * scale), fontWeight: 700,
            color: '#fff', letterSpacing: 0.5, lineHeight: 1.2,
            textShadow: `0 0 8px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.8)`,
          }}>{posa.nome}</div>
        </div>

        {/* ★ FASE 4: Waifu associata — preview faccia o nome */}
        {(waifuPreview || posa.waifu_id) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: Math.round(5 * scale),
            background: 'rgba(255,255,255,0.05)',
            borderRadius: Math.round(5 * scale),
            padding: `${Math.round(3 * scale)}px ${Math.round(6 * scale)}px`,
            border: `1px solid rgba(255,255,255,0.1)`,
          }}>
            {/* Mini avatar waifu */}
            <div style={{
              width: Math.round(22 * scale), height: Math.round(22 * scale),
              borderRadius: '50%', overflow: 'hidden',
              border: `1.5px solid ${rb.inner}66`,
              flexShrink: 0,
              background: `radial-gradient(circle, ${rb.inner}22, rgba(0,0,0,0.5))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {waifuPreview?.asset_statica ? (
                <img src={waifuPreview.asset_statica} alt={waifuPreview.nome}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }}
                />
              ) : (
                <span style={{ fontSize: Math.round(11 * scale), opacity: 0.6 }}>♛</span>
              )}
            </div>
            <span style={{
              fontSize: Math.round(7.5 * scale), color: rb.inner,
              fontFamily: 'Orbitron, monospace', letterSpacing: 0.5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: Math.round(100 * scale),
            }}>
              {waifuPreview?.nome || posa.waifu_id || 'Universale'}
            </span>
          </div>
        )}

        {/* Universale se nessuna waifu_id */}
        {!posa.waifu_id && !waifuPreview && (
          <div style={{
            fontSize: Math.round(7.5 * scale), color: 'rgba(255,255,255,0.4)',
            fontFamily: 'Orbitron, monospace', letterSpacing: 1,
            textTransform: 'uppercase',
          }}>◈ Universale</div>
        )}
      </div>

      {/* Copie badge */}
      {quantita > 1 && (
        <div style={{
          position: 'absolute', bottom: Math.round(8 * scale), right: Math.round(8 * scale),
          background: 'rgba(0,0,0,0.8)', border: `1px solid ${rb.inner}`,
          color: rb.inner, fontSize: Math.round(9 * scale), fontWeight: 700,
          padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
          borderRadius: Math.round(6 * scale),
          fontFamily: 'Orbitron, sans-serif', letterSpacing: 1, zIndex: 6,
        }}>×{quantita}</div>
      )}

      {/* Angoli decorativi */}
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
    </div>
  );
}
