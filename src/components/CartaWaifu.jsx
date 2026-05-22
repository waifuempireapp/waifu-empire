// src/components/CartaWaifu.jsx
// IMPERO DELLE WAIFU — Redesign · Sistema Carte
// Export e props IDENTICI alla versione precedente:
//   CartaWaifu(waifu, datiCollezione, dimensione, onClick, evidenziato, tipo,
//              outfitCatalogo, poseCatalogo, equip, videoAttivo, videoRef,
//              onVideoEnd, isHot, censurata)
//   CartaOutfit(outfit, quantita, onClick, evidenziato, dimensione)
//   CartaPosa(posa, quantita, onClick, evidenziato, waifuPreview, dimensione)
'use client';
import React, { useState } from 'react';
import { RARITA } from '@/lib/constants';
import { ARCHETIPI } from '@/lib/promptGenerator';
import { ikUrl } from '@/lib/imagekitUrl';

// Lookup id → archetipo
const ARCHETIPI_MAP = {};
if (ARCHETIPI) ARCHETIPI.forEach(a => { ARCHETIPI_MAP[a.id] = a; });

// ====================================================================
// PALETTE RARITÀ — Premium night
// ====================================================================
const RARITY_BORDER = {
  comune:      { outer: '#b4bcc8', inner: '#dfe5ef', glow: 'rgba(180,188,200,0.45)', bg: 'linear-gradient(160deg, #293142 0%, #0c0e1a 100%)' },
  raro:        { outer: '#5aa9ff', inner: '#9fcaff', glow: 'rgba(90,169,255,0.55)',  bg: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)' },
  epico:       { outer: '#b573ff', inner: '#dabaff', glow: 'rgba(181,115,255,0.55)', bg: 'linear-gradient(160deg, #2a1255 0%, #10052a 100%)' },
  leggendario: { outer: '#ffc861', inner: '#ffe9a8', glow: 'rgba(255,200,97,0.65)',  bg: 'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)' },
  immersivo:   { outer: '#ff7eb6', inner: '#ffc3da', glow: 'rgba(255,126,182,0.7)',  bg: 'linear-gradient(160deg, #4f1245 0%, #1e0420 100%)' },
};

// Simboli archetipo
const ARCHETIPO_SIMBOLI = {
  guerriera_stoica:    { sym: '⚔',  color: '#ff8b6f' },
  maga_timida:         { sym: '✦',  color: '#c5a4ff' },
  regina_imperiosa:    { sym: '♛',  color: '#ffd680' },
  studiosa_pensosa:    { sym: '✎',  color: '#9fcaff' },
  viaggiatrice_solare: { sym: '☀',  color: '#ffb86b' },
  idol_radiante:       { sym: '★',  color: '#ff9ec6' },
  sacerdotessa_etera:  { sym: '⛩',  color: '#94f0e3' },
  spadaccina_audace:   { sym: '⚡',  color: '#ffe07a' },
  principessa_drago:   { sym: '◈',  color: '#ff7a7a' },
  ladra_furtiva:       { sym: '◇',  color: '#8af0d8' },
  oracolo_mistico:     { sym: '◉',  color: '#b89dff' },
  pirata_temeraria:    { sym: '☠',  color: '#9cb0c7' },
  fata_giocosa:        { sym: '✿',  color: '#b9ed7a' },
  ninja_letale:        { sym: '◆',  color: '#8da4c0' },
  dea_celestiale:      { sym: '☽',  color: '#ffe7a8' },
  cyber_hacker:        { sym: '⌘',  color: '#7af0ff' },
  tsundere_classica:   { sym: '❤',  color: '#ff85a8' },
  demone_seducente:    { sym: '♦',  color: '#ff6a8e' },
  sciamana_natura:     { sym: '✼',  color: '#7be09b' },
  samurai_onorata:     { sym: '⛧',  color: '#c8c0b0' },
};
function getArchetipoSym(archetipoId, rarColor) {
  return ARCHETIPO_SIMBOLI[archetipoId] || { sym: '◈', color: rarColor };
}

// ====================================================================
// STAT CIRCLE — Cerchio progress con valore al centro
// ====================================================================
function StatCircle({ value, statKey, icon, color, size = 34 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const maxVal = statKey === 'piedi' ? 45
    : statKey === 'eta' ? 5000
    : statKey === 'exp' ? 5000
    : statKey === 'capelli' ? 10
    : 7;
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
          fontSize: size * 0.32, fontWeight: 700, color: '#fff',
          fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
          textShadow: `0 0 6px ${color}`,
          letterSpacing: '-0.02em',
        }}>{value}</div>
      </div>
      <div style={{
        fontSize: Math.max(8, size * 0.30),
        lineHeight: 1,
        color,
        filter: `drop-shadow(0 0 3px ${color})`,
      }}>{icon}</div>
    </div>
  );
}

// ====================================================================
// TAG ARCHETIPO — Cerchio decorativo
// ====================================================================
function ArchetipoTag({ archetipoId, rarColor, scale = 1 }) {
  if (!archetipoId) return null;
  const sym = getArchetipoSym(archetipoId, rarColor);
  const sz = Math.round(26 * scale);

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: Math.round(4 * scale) }}>
      <div style={{
        width: sz, height: sz,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${sym.color}55, rgba(7,5,26,0.85))`,
        border: `1.5px solid ${sym.color}aa`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(sz * 0.46),
        color: sym.color,
        boxShadow: `0 0 8px ${sym.color}66, inset 0 0 6px rgba(0,0,0,0.3)`,
        flexShrink: 0,
      }}>{sym.sym}</div>
    </div>
  );
}

// ====================================================================
// CARTA WAIFU — Full-art Premium
// ====================================================================
export function CartaWaifu({
  waifu, datiCollezione, dimensione = 'normale',
  onClick, evidenziato = false, tipo = 'auto',
  outfitCatalogo = [], poseCatalogo = [], equip,
  videoAttivo = false, videoRef = null, onVideoEnd,
  isHot = false, censurata = false,
}) {
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

  const preset = dimensione === 'piccola' ? 'card' : dimensione === 'grande' ? 'full' : 'normal';
  const imgSrc = ikUrl(usaImmersiva ? waifu.asset_immersiva : (waifu.asset_statica || null), preset);
  const statSize = Math.round(30 * scale);

  // Se censurata (waifu Hot senza Pass Hard): blocca click e zoom
  const handleClick = censurata ? undefined : () => { onClick?.(); };
  const handleVideoEnd = () => { setVideoFinito(true); onVideoEnd?.(); };
  const showFoil = waifu.rarita === 'epico' || waifu.rarita === 'leggendario' || waifu.rarita === 'immersivo';

  return (
    <div
      className="carta-waifu-root"
      onClick={handleClick}
      style={{
        width: W, height: H,
        position: 'relative',
        cursor: censurata ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
        borderRadius: Math.round(14 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : videoAttivo ? '#ff7eb6' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)`
          : videoAttivo
            ? `0 0 36px rgba(255,126,182,0.8), inset 0 0 22px rgba(255,126,182,0.15)`
            : `0 0 22px ${rb.glow}, inset 0 0 18px rgba(0,0,0,0.35)`,
        cursor: (onClick || hasVideo) ? 'pointer' : 'default',
        overflow: 'hidden',
        background: rb.bg,
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => (onClick || hasVideo) && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
      onMouseLeave={(e) => (onClick || hasVideo) && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
    >
      {/* Bordo interno */}
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(11 * scale),
        border: `1px solid ${rb.inner}3a`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* IMMAGINE / FALLBACK */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: Math.round(12 * scale),
        overflow: 'hidden',
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        {censurata ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {imgSrc && (
              <img src={imgSrc} alt={waifu.nome}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', filter: 'blur(14px) brightness(0.3)' }} />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: Math.round(32 * scale), filter: 'drop-shadow(0 0 8px rgba(255,140,0,0.8))' }}>🔒</span>
              <div style={{
                fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
                fontSize: Math.max(7, Math.round(8 * scale)),
                color: 'rgba(241,235,255,0.7)',
                letterSpacing: '0.18em', textAlign: 'center', lineHeight: 1.4,
                textTransform: 'uppercase',
              }}>Pass Hard<br/>richiesto</div>
              <button
                onClick={e => { e.stopPropagation(); window.dispatchEvent(new Event('impero:apri-negozio')); }}
                style={{
                  marginTop: 4,
                  background: 'rgba(255,140,0,0.18)',
                  border: '1px solid rgba(255,140,0,0.5)',
                  borderRadius: 7,
                  color: '#ffb86b',
                  fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
                  fontSize: Math.max(6, Math.round(8 * scale)),
                  padding: '4px 10px', cursor: 'pointer',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}
              >Sblocca</button>
            </div>
          </div>
        ) : imgSrc ? (
          <img src={imgSrc} alt={waifu.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
        ) : (
          // Placeholder full-card senza asset
          <div style={{
            width: '100%', height: '100%',
            background:
              `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.06), transparent 55%),
               repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 14px),
               ${rb.bg}`,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            position: 'relative',
          }}>
            {/* silhouette */}
            <div style={{
              width: '75%', height: '88%',
              background:
                `radial-gradient(40% 18% at 50% 22%, rgba(0,0,0,0.55) 0%, transparent 70%),
                 radial-gradient(60% 50% at 50% 75%, rgba(0,0,0,0.45) 0%, transparent 65%)`,
              filter: 'blur(0.5px)',
            }} />
            <div style={{
              position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
              fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
              fontSize: Math.round(8 * scale), letterSpacing: '0.18em',
              color: 'rgba(241,235,255,0.4)', textTransform: 'uppercase',
            }}>{(waifu.nome || 'WAIFU').toUpperCase()} · ART</div>
          </div>
        )}

        {/* HOLO FOIL — solo per epico+ e quando non censurata */}
        {showFoil && !censurata && (
          <div className={`foil ${waifu.rarita === 'immersivo' ? 'foil--strong' : ''}`} />
        )}

        {/* BADGE HOT */}
        {isHot && !censurata && (
          <div style={{
            position: 'absolute', top: Math.round(6 * scale), left: Math.round(6 * scale),
            background: 'linear-gradient(135deg, rgba(255,69,0,0.92), rgba(255,140,0,0.92))',
            color: '#fff',
            fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
            fontSize: Math.max(7, Math.round(8 * scale)),
            fontWeight: 800, letterSpacing: '0.12em',
            padding: `${Math.round(2 * scale)}px ${Math.round(7 * scale)}px`,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.4)',
            boxShadow: '0 0 10px rgba(255,69,0,0.65)',
            pointerEvents: 'none', zIndex: 12, textTransform: 'uppercase',
          }}>🔥 HOT</div>
        )}
      </div>

      {/* VIDEO IMMERSIVO */}
      {hasVideo && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: Math.round(11 * scale), overflow: 'hidden',
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
          {videoFinito && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{
                color: '#fff',
                fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
                fontSize: Math.round(11 * scale), opacity: 0.85,
                letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>◀ Rivedi</div>
            </div>
          )}
        </div>
      )}

      {/* OVERLAY TOP — nome + livello + archetipo + stelle */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: `${Math.round(9 * scale)}px ${Math.round(10 * scale)}px`,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
        zIndex: videoAttivo ? 0 : 4,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 6,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
            fontSize: Math.round(14 * scale), fontWeight: 700,
            color: '#fff', letterSpacing: '-0.005em',
            textShadow: `0 0 12px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
            lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{waifu.nome}</div>
          {datiCollezione && (
            <div style={{
              fontSize: Math.round(8.5 * scale),
              color: rb.inner,
              letterSpacing: '0.22em',
              fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
              marginTop: 3,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              textTransform: 'uppercase',
            }}>Lv.{datiCollezione.livello || 1}</div>
          )}
          {waifu.archetipo && (
            <ArchetipoTag archetipoId={waifu.archetipo} rarColor={rb.inner} scale={scale} />
          )}
        </div>
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

      {/* TAG RARITÀ (pill laterale) */}
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
        zIndex: videoAttivo ? 0 : 5,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>{rar.nome}</div>

      {/* OVERLAY BOTTOM — stats */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: `${Math.round(22 * scale)}px ${Math.round(8 * scale)}px ${Math.round(9 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        zIndex: videoAttivo ? 0 : 4,
        opacity: videoAttivo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        {/* Riga HP / Velocità / Crit — sopra la linea ornamento */}
        {(() => {
          const hp   = datiCollezione?.hp   ?? waifu.hp   ?? null;
          const vel  = datiCollezione?.velocita ?? waifu.velocita_base ?? null;
          const crit = datiCollezione?.crit_chance ?? waifu.crit_chance_base ?? null;
          if (hp == null && vel == null && crit == null) return null;
          // Icone e testo leggermente più grandi (confrontabili con le stats principali)
          const fsIcon = Math.round(11 * scale);  // emoji icona
          const fsVal  = Math.round(9 * scale);   // valore numerico
          const fsHpI  = Math.round(12 * scale);
          const fsHpV  = Math.round(10.5 * scale);
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: Math.round(5 * scale), padding: `0 ${Math.round(3 * scale)}px` }}>
              {vel != null ? (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: fsVal, color: '#6cf0e0', textAlign: 'center' }}>
                  <div style={{ fontSize: fsIcon }}>⚡</div>
                  <div style={{ fontWeight: 700 }}>{Math.round(vel)}</div>
                </div>
              ) : <div />}
              {hp != null && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: fsHpV, color: '#06d6a0', textAlign: 'center', background: 'rgba(6,214,160,0.12)', borderRadius: Math.round(5 * scale), padding: `${Math.round(1 * scale)}px ${Math.round(5 * scale)}px` }}>
                  <div style={{ fontSize: fsHpI }}>💚</div>
                  <div style={{ fontWeight: 800 }}>{Math.round(hp)}</div>
                </div>
              )}
              {crit != null ? (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: fsVal, color: '#fbbf24', textAlign: 'center' }}>
                  <div style={{ fontSize: fsIcon }}>💥</div>
                  <div style={{ fontWeight: 700 }}>{Math.round(crit * 100)}%</div>
                </div>
              ) : <div />}
            </div>
          );
        })()}
        {/* Linea ornamento */}
        <div style={{
          width: '70%', height: 1, margin: `0 auto ${Math.round(7 * scale)}px`,
          background: `linear-gradient(90deg, transparent, ${rb.inner}cc, transparent)`,
          boxShadow: `0 0 6px ${rb.glow}`,
        }} />
        {/* Stats principali con nuove emoji */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <StatCircle value={tetteEff}    statKey="tette"   icon="🍑" color="#ff9ec6" size={statSize} />
          <StatCircle value={piediEff}    statKey="piedi"   icon="🦶" color="#b573ff" size={statSize} />
          <StatCircle value={etaEff}      statKey="eta"     icon="⏳" color="#6cf0e0" size={statSize} />
          <StatCircle value={capelliEff}  statKey="capelli" icon="💇" color="#ffc861" size={statSize} />
          <StatCircle value={expEff}      statKey="exp"     icon="⭐" color="#a78bfa" size={statSize} />
        </div>
      </div>

      {/* CORNER BRACKETS */}
      {[
        { top: Math.round(5*scale), left: Math.round(5*scale), borderTopLeftRadius: Math.round(10*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
        { top: Math.round(5*scale), right: Math.round(5*scale), borderTopRightRadius: Math.round(10*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), right: Math.round(5*scale), borderBottomRightRadius: Math.round(10*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), left: Math.round(5*scale), borderBottomLeftRadius: Math.round(10*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: Math.round(14 * scale), height: Math.round(14 * scale),
          opacity: 0.65,
          zIndex: 5,
          pointerEvents: 'none',
          ...c.borders,
          top: c.top, bottom: c.bottom, left: c.left, right: c.right,
          borderTopLeftRadius: c.borderTopLeftRadius,
          borderTopRightRadius: c.borderTopRightRadius,
          borderBottomRightRadius: c.borderBottomRightRadius,
          borderBottomLeftRadius: c.borderBottomLeftRadius,
        }} />
      ))}

      {/* BATTLE STATS */}
      {waifu.battleStats?.maxHp && !videoAttivo && (
        <div style={{
          position: 'absolute', top: Math.round(56 * scale), left: Math.round(5 * scale),
          display: 'flex', flexDirection: 'column', gap: Math.round(3 * scale), zIndex: 6,
        }}>
          <div style={{
            background: 'rgba(7,5,26,0.85)',
            border: '1px solid rgba(88,224,163,0.5)',
            borderRadius: Math.round(5 * scale),
            padding: `${Math.round(1.5*scale)}px ${Math.round(6*scale)}px`,
            fontSize: Math.round(7.5 * scale),
            fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
            fontWeight: 700,
            color: '#58e0a3', display: 'flex', alignItems: 'center', gap: 4,
            backdropFilter: 'blur(4px)',
          }}>
            <span>❤</span><span>{waifu.battleStats.maxHp}</span>
          </div>
          {waifu.battleStats?.speed && (
            <div style={{
              background: 'rgba(7,5,26,0.85)',
              border: '1px solid rgba(255,133,182,0.5)',
              borderRadius: Math.round(5 * scale),
              padding: `${Math.round(1.5*scale)}px ${Math.round(6*scale)}px`,
              fontSize: Math.round(7.5 * scale),
              fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
              fontWeight: 700,
              color: '#ff85b6', display: 'flex', alignItems: 'center', gap: 4,
              backdropFilter: 'blur(4px)',
            }}>
              <span>⚡</span><span>{waifu.battleStats.speed}</span>
            </div>
          )}
        </div>
      )}

      {/* COPIE BADGE */}
      {datiCollezione && datiCollezione.copie > 1 && !videoAttivo && (
        <div style={{
          position: 'absolute', bottom: Math.round(8*scale), right: Math.round(8*scale),
          background: 'rgba(7,5,26,0.88)',
          border: `1px solid ${rb.inner}88`,
          color: rb.inner,
          fontSize: Math.round(10 * scale), fontWeight: 700,
          padding: `${Math.round(2*scale)}px ${Math.round(7*scale)}px`,
          borderRadius: Math.round(7 * scale),
          fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
          letterSpacing: '-0.02em',
          backdropFilter: 'blur(4px)',
          boxShadow: `0 0 8px ${rb.glow}`,
          zIndex: 6,
        }}>×{datiCollezione.copie}</div>
      )}
    </div>
  );
}

// ====================================================================
// CARTA OUTFIT — Stile waifu full-art
// ====================================================================
const SLOT_BG = {
  faccia: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)',
  petto:  'linear-gradient(160deg, #2a1255 0%, #10052a 100%)',
  gambe:  'linear-gradient(160deg, #0a3a2a 0%, #04140d 100%)',
  piedi:  'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)',
};
const SLOT_COLORS = {
  faccia: { primary: '#5aa9ff', glow: 'rgba(90,169,255,0.5)' },
  petto:  { primary: '#b573ff', glow: 'rgba(181,115,255,0.5)' },
  gambe:  { primary: '#58e0a3', glow: 'rgba(88,224,163,0.5)' },
  piedi:  { primary: '#ffc861', glow: 'rgba(255,200,97,0.5)' },
};
const SLOT_ICONS = { faccia: '👁', petto: '✦', gambe: '⚘', piedi: '◈' };
const ABILITA_ICONS = {
  stat_up:    '↑', stat_down:  '↓',
  opp_up:     '⬆', opp_down:   '⬇',
  reuse_stat: '↺', reuse_waifu:'♻',
};

function AbilitaTag({ abilita, color, scale = 1 }) {
  if (!abilita || !abilita.tipo) return null;
  const icon = ABILITA_ICONS[abilita.tipo] || '◈';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: Math.round(4 * scale),
      background: 'rgba(7,5,26,0.75)',
      border: `1px solid ${color}66`,
      borderRadius: Math.round(6 * scale),
      padding: `${Math.round(2.5 * scale)}px ${Math.round(6 * scale)}px`,
      marginTop: Math.round(3 * scale),
      backdropFilter: 'blur(4px)',
    }}>
      <span style={{ color, fontSize: Math.round(10 * scale), fontWeight: 700,
        textShadow: `0 0 4px ${color}` }}>{icon}</span>
      <span style={{
        color: '#e8e0ff', fontSize: Math.round(7.5 * scale),
        fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
        letterSpacing: '0.08em',
        maxWidth: Math.round(95 * scale),
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}>{abilita.descrizione || abilita.tipo}</span>
    </div>
  );
}

function OutfitImagePlaceholder({ nome, slot, scale = 1, asset }) {
  const sc = SLOT_COLORS[slot] || SLOT_COLORS.petto;
  const bg = SLOT_BG[slot] || SLOT_BG.petto;
  const icon = SLOT_ICONS[slot] || '✦';

  if (asset) {
    return (
      <img src={asset} alt={nome}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
    );
  }

  const iniziale = (nome || '?')[0].toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `${bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 4,
      position: 'relative',
    }}>
      {/* Pattern texture */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 4px, transparent 4px 10px)',
        opacity: 0.6,
      }}/>
      <div style={{
        fontSize: Math.round(54 * scale),
        opacity: 0.22,
        filter: `drop-shadow(0 0 14px ${sc.primary})`,
        color: sc.primary,
        position: 'relative',
      }}>{icon}</div>
      <div style={{
        fontSize: Math.round(22 * scale), fontWeight: 800, color: sc.primary,
        opacity: 0.5,
        fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
        textShadow: `0 0 10px ${sc.primary}`,
        position: 'relative',
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
    ? getArchetipoSym(outfit.archetipo_compatibile, sc.primary) : null;
  const archetipoNome = outfit.archetipo_compatibile
    ? (ARCHETIPI_MAP[outfit.archetipo_compatibile]?.nome || outfit.archetipo_compatibile.replace(/_/g, ' '))
    : null;

  const showFoil = outfit.rarita === 'epico' || outfit.rarita === 'leggendario' || outfit.rarita === 'immersivo';

  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H, position: 'relative',
        borderRadius: Math.round(14 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)`
          : `0 0 22px ${rb.glow}, inset 0 0 18px rgba(0,0,0,0.35)`,
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
        borderRadius: Math.round(11 * scale),
        border: `1px solid ${rb.inner}3a`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* AREA IMMAGINE */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '63%',
        overflow: 'hidden',
        borderRadius: `${Math.round(12 * scale)}px ${Math.round(12 * scale)}px 0 0`,
      }}>
        <OutfitImagePlaceholder nome={outfit.nome} slot={outfit.slot} scale={scale} asset={outfit.asset} />
        {showFoil && <div className="foil foil--soft" />}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
          background: `linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)`,
        }} />
      </div>

      {/* TAG SLOT */}
      <div style={{
        position: 'absolute', top: Math.round(9 * scale), left: Math.round(9 * scale),
        background: 'rgba(7,5,26,0.82)',
        border: `1px solid ${sc.primary}88`,
        borderRadius: 999,
        padding: `${Math.round(2.5 * scale)}px ${Math.round(8 * scale)}px`,
        display: 'flex', alignItems: 'center', gap: Math.round(4 * scale),
        zIndex: 5,
        backdropFilter: 'blur(6px)',
      }}>
        <span style={{ fontSize: Math.round(11 * scale), color: sc.primary,
          filter: `drop-shadow(0 0 3px ${sc.primary})` }}>{SLOT_ICONS[outfit.slot] || '?'}</span>
        <span style={{
          fontSize: Math.round(7.5 * scale), color: sc.primary,
          fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
          letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
        }}>{outfit.slot || 'slot'}</span>
      </div>

      {/* TAG RARITÀ */}
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

      {/* STELLE */}
      <div style={{
        position: 'absolute', top: Math.round(9 * scale), right: Math.round(9 * scale),
        display: 'flex', gap: 1.5, zIndex: 5,
      }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: Math.round(10 * scale),
            textShadow: `0 0 6px ${rb.glow}`, filter: `drop-shadow(0 0 3px ${rb.inner})` }}>★</span>
        ))}
      </div>

      {/* INFO INFERIORE */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '37%',
        padding: `${Math.round(8 * scale)}px ${Math.round(11 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        zIndex: 4,
      }}>
        <div style={{
          width: '80%', height: 1, marginBottom: Math.round(6 * scale),
          background: `linear-gradient(90deg, transparent, ${sc.primary}aa, transparent)`,
        }} />

        <div style={{
          fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
          fontSize: Math.round(12 * scale), fontWeight: 700,
          color: '#fff', letterSpacing: '-0.005em', lineHeight: 1.15,
          marginBottom: Math.round(4 * scale),
          textShadow: `0 0 10px ${sc.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
        }}>{outfit.nome}</div>

        {archetipoSym && archetipoNome && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: Math.round(5 * scale),
            marginBottom: Math.round(4 * scale),
          }}>
            <div style={{
              width: Math.round(18 * scale), height: Math.round(18 * scale),
              borderRadius: '50%',
              background: `radial-gradient(circle, ${archetipoSym.color}44, rgba(7,5,26,0.6))`,
              border: `1px solid ${archetipoSym.color}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.round(10 * scale), color: archetipoSym.color,
              flexShrink: 0,
            }}>{archetipoSym.sym}</div>
            <span style={{
              fontSize: Math.round(7.5 * scale), color: archetipoSym.color,
              fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
              letterSpacing: '0.16em', opacity: 0.9, textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: Math.round(110 * scale),
              fontWeight: 600,
            }}>{archetipoNome}</span>
          </div>
        )}

        {!isComune && outfit.abilita && (
          <AbilitaTag abilita={outfit.abilita} color={sc.primary} scale={scale} />
        )}
      </div>

      {/* COPIE */}
      {quantita > 1 && (
        <div style={{
          position: 'absolute', top: Math.round(46 * scale), left: Math.round(8 * scale),
          background: 'rgba(7,5,26,0.88)',
          border: `1px solid ${rb.inner}88`,
          color: rb.inner,
          fontSize: Math.round(9 * scale), fontWeight: 700,
          padding: `${Math.round(2*scale)}px ${Math.round(6*scale)}px`,
          borderRadius: Math.round(6 * scale),
          fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
          backdropFilter: 'blur(4px)',
          zIndex: 7,
        }}>×{quantita}</div>
      )}

      {/* CORNER BRACKETS */}
      {[
        { top: Math.round(5*scale), left: Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
        { top: Math.round(5*scale), right: Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), right: Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), left: Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: Math.round(14 * scale), height: Math.round(14 * scale),
          opacity: 0.65, zIndex: 5, pointerEvents: 'none',
          ...c.borders,
          top: c.top, bottom: c.bottom, left: c.left, right: c.right,
        }} />
      ))}
    </div>
  );
}

// ====================================================================
// CARTA POSA
// ====================================================================
const POSA_SILHOUETTES = {
  default: (color) => (
    <svg viewBox="0 0 80 120" style={{ width: '60%', height: '70%', opacity: 0.22 }}>
      <ellipse cx="40" cy="18" rx="12" ry="13" fill={color} />
      <path d="M28,31 Q40,28 52,31 L56,75 Q40,80 24,75 Z" fill={color} />
      <rect x="28" y="73" width="10" height="35" rx="4" fill={color} />
      <rect x="42" y="73" width="10" height="35" rx="4" fill={color} />
      <rect x="13" y="32" width="9" height="30" rx="4" fill={color} transform="rotate(-8,17,32)" />
      <rect x="58" y="32" width="9" height="30" rx="4" fill={color} transform="rotate(8,63,32)" />
    </svg>
  ),
  seduta: (color) => (
    <svg viewBox="0 0 80 100" style={{ width: '60%', height: '60%', opacity: 0.22 }}>
      <ellipse cx="40" cy="14" rx="11" ry="12" fill={color} />
      <path d="M30,26 Q40,23 50,26 L52,58 Q40,62 28,58 Z" fill={color} />
      <rect x="26" y="57" width="10" height="28" rx="4" fill={color} transform="rotate(15,31,57)" />
      <rect x="42" y="57" width="10" height="28" rx="4" fill={color} transform="rotate(-15,47,57)" />
    </svg>
  ),
  combattimento: (color) => (
    <svg viewBox="0 0 80 120" style={{ width: '60%', height: '70%', opacity: 0.22 }}>
      <ellipse cx="38" cy="16" rx="11" ry="12" fill={color} />
      <path d="M26,28 Q38,24 52,28 L56,72 Q38,77 24,72 Z" fill={color} transform="rotate(-5,38,50)" />
      <rect x="10" y="28" width="9" height="34" rx="4" fill={color} transform="rotate(-35,14,28)" />
      <rect x="58" y="28" width="9" height="34" rx="4" fill={color} transform="rotate(70,63,28)" />
      <rect x="26" y="71" width="10" height="36" rx="4" fill={color} transform="rotate(-10,31,71)" />
      <rect x="43" y="71" width="10" height="32" rx="4" fill={color} transform="rotate(25,48,71)" />
    </svg>
  ),
};

function PosaSilhouette({ tipoPosa, rarColor }) {
  const tipo = tipoPosa?.toLowerCase().includes('sedut') ? 'seduta'
    : tipoPosa?.toLowerCase().includes('combatt') ? 'combattimento'
    : 'default';
  const SvgFn = POSA_SILHOUETTES[tipo] || POSA_SILHOUETTES.default;
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background:
        `radial-gradient(ellipse at 50% 35%, ${rarColor}1f, transparent 70%),
         repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 4px, transparent 4px 12px)`,
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

  const silColor = '#cdd6e3';
  const showFoil = posa.rarita === 'epico' || posa.rarita === 'leggendario' || posa.rarita === 'immersivo';

  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H, position: 'relative',
        borderRadius: Math.round(14 * scale),
        border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : rb.outer}`,
        boxShadow: evidenziato
          ? `0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)`
          : `0 0 22px ${rb.glow}, inset 0 0 18px rgba(0,0,0,0.35)`,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        background: rb.bg,
        transition: 'all 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
    >
      <div style={{
        position: 'absolute', inset: Math.round(3 * scale),
        borderRadius: Math.round(11 * scale),
        border: `1px solid ${rb.inner}3a`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* SILHOUETTE area */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '63%', overflow: 'hidden',
        borderRadius: `${Math.round(12 * scale)}px ${Math.round(12 * scale)}px 0 0`,
      }}>
        {posa.asset ? (
          <img src={posa.asset} alt={posa.nome}
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
        ) : (
          <PosaSilhouette tipoPosa={posa.fillers?.tipo || posa.nome} rarColor={silColor} />
        )}
        {showFoil && <div className="foil foil--soft" />}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
          background: `linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%)`,
        }} />
      </div>

      {/* TAG RARITÀ */}
      <div style={{
        position: 'absolute', top: Math.round(9 * scale), right: 0,
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

      {/* STELLE */}
      <div style={{
        position: 'absolute', top: Math.round(9 * scale), left: Math.round(9 * scale),
        display: 'flex', gap: 1.5, zIndex: 5,
      }}>
        {[...Array(rar.stelle)].map((_, i) => (
          <span key={i} style={{ color: rb.inner, fontSize: Math.round(10 * scale),
            textShadow: `0 0 6px ${rb.glow}`, filter: `drop-shadow(0 0 3px ${rb.inner})` }}>★</span>
        ))}
      </div>

      {/* INFO */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '37%',
        padding: `${Math.round(8 * scale)}px ${Math.round(11 * scale)}px`,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        zIndex: 4,
      }}>
        <div style={{
          width: '80%', height: 1, marginBottom: Math.round(6 * scale),
          background: `linear-gradient(90deg, transparent, ${rb.inner}aa, transparent)`,
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: Math.round(6 * scale),
          marginBottom: Math.round(5 * scale),
        }}>
          <span style={{ fontSize: Math.round(14 * scale), color: rb.inner,
            filter: `drop-shadow(0 0 4px ${rb.glow})` }}>⚜</span>
          <div style={{
            fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
            fontSize: Math.round(12 * scale), fontWeight: 700,
            color: '#fff', letterSpacing: '-0.005em', lineHeight: 1.15,
            textShadow: `0 0 10px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{posa.nome}</div>
        </div>

        {(waifuPreview || posa.waifu_id) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: Math.round(6 * scale),
            background: 'rgba(255,255,255,0.05)',
            borderRadius: Math.round(7 * scale),
            padding: `${Math.round(3.5 * scale)}px ${Math.round(7 * scale)}px`,
            border: '1px solid rgba(255,255,255,0.10)',
          }}>
            <div style={{
              width: Math.round(22 * scale), height: Math.round(22 * scale),
              borderRadius: '50%', overflow: 'hidden',
              border: `1.5px solid ${rb.inner}88`,
              flexShrink: 0,
              background: `radial-gradient(circle, ${rb.inner}33, rgba(7,5,26,0.6))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {waifuPreview?.asset_statica ? (
                <img src={waifuPreview.asset_statica} alt={waifuPreview.nome}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }} />
              ) : (
                <span style={{ fontSize: Math.round(11 * scale), opacity: 0.7, color: rb.inner }}>♛</span>
              )}
            </div>
            <span style={{
              fontSize: Math.round(8 * scale), color: rb.inner,
              fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
              letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: Math.round(110 * scale),
            }}>{waifuPreview?.nome || posa.waifu_id || 'Universale'}</span>
          </div>
        )}

        {!posa.waifu_id && !waifuPreview && (
          <div style={{
            fontSize: Math.round(8 * scale), color: 'rgba(241,235,255,0.45)',
            fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
            letterSpacing: '0.22em', textTransform: 'uppercase',
          }}>◈ Universale</div>
        )}
      </div>

      {/* COPIE */}
      {quantita > 1 && (
        <div style={{
          position: 'absolute', bottom: Math.round(8*scale), right: Math.round(8*scale),
          background: 'rgba(7,5,26,0.88)',
          border: `1px solid ${rb.inner}88`,
          color: rb.inner,
          fontSize: Math.round(10 * scale), fontWeight: 700,
          padding: `${Math.round(2*scale)}px ${Math.round(7*scale)}px`,
          borderRadius: Math.round(7 * scale),
          fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
          backdropFilter: 'blur(4px)',
          boxShadow: `0 0 8px ${rb.glow}`,
          zIndex: 6,
        }}>×{quantita}</div>
      )}

      {/* CORNERS */}
      {[
        { top: Math.round(5*scale), left: Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
        { top: Math.round(5*scale), right: Math.round(5*scale), borders: { borderTop: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), right: Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderRight: `1.5px solid ${rb.inner}` } },
        { bottom: Math.round(5*scale), left: Math.round(5*scale), borders: { borderBottom: `1.5px solid ${rb.inner}`, borderLeft: `1.5px solid ${rb.inner}` } },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: Math.round(14 * scale), height: Math.round(14 * scale),
          opacity: 0.65, zIndex: 5, pointerEvents: 'none',
          ...c.borders,
          top: c.top, bottom: c.bottom, left: c.left, right: c.right,
        }} />
      ))}
    </div>
  );
}
