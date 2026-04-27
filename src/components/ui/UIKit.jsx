// src/components/ui/UIKit.jsx
// Libreria di componenti UI in stile Genshin Impact / Honkai Star Rail
// Frame ornamentali, pannelli con decorazioni angolari, bottoni con bordo decorativo

'use client';
import React from 'react';

// ============================================================
// PANNELLO ORNATO - sfondo decorato con angoli a spillo (Genshin style)
// ============================================================
export function PannelloOrnato({ children, variant = 'default', glow = '#f59e0b', style = {}, ...rest }) {
  const variants = {
    default: { bg: 'linear-gradient(160deg, rgba(15,10,30,0.92), rgba(26,15,46,0.88))', border: 'rgba(245,158,11,0.45)' },
    dark:    { bg: 'linear-gradient(160deg, rgba(8,4,16,0.95), rgba(15,10,30,0.92))', border: 'rgba(245,158,11,0.3)' },
    accent:  { bg: 'linear-gradient(160deg, rgba(245,158,11,0.08), rgba(236,72,153,0.05))', border: 'rgba(245,158,11,0.6)' },
    purple:  { bg: 'linear-gradient(160deg, rgba(168,85,247,0.1), rgba(15,10,30,0.92))', border: 'rgba(168,85,247,0.5)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <div style={{
      position: 'relative',
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 4,
      padding: 18,
      backdropFilter: 'blur(10px)',
      boxShadow: `0 0 30px ${glow}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
      ...style,
    }} {...rest}>
      {/* Angoli ornamentali */}
      <CornerOrn pos="tl" colore={glow} />
      <CornerOrn pos="tr" colore={glow} />
      <CornerOrn pos="bl" colore={glow} />
      <CornerOrn pos="br" colore={glow} />
      {children}
    </div>
  );
}

function CornerOrn({ pos, colore }) {
  const styles = {
    tl: { top: -1, left: -1, transform: 'rotate(0deg)' },
    tr: { top: -1, right: -1, transform: 'rotate(90deg)' },
    br: { bottom: -1, right: -1, transform: 'rotate(180deg)' },
    bl: { bottom: -1, left: -1, transform: 'rotate(270deg)' },
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ position: 'absolute', pointerEvents: 'none', ...styles[pos] }}>
      <path d="M0,0 L24,0 L24,3 L3,3 L3,24 L0,24 Z" fill={colore} opacity="0.85" />
      <circle cx="3" cy="3" r="1.5" fill={colore} />
    </svg>
  );
}

// ============================================================
// TITOLO ORNATO con linee decorative ai lati
// ============================================================
export function TitoloOrnato({ children, livello = 1, colore = '#f59e0b', glow = true, allineamento = 'center', style = {} }) {
  const sizes = {
    1: { fs: 'clamp(20px, 4vw, 28px)', ls: 5, mb: 10, ff: 'Fredoka, Cinzel, serif', fw: 700 },
    2: { fs: 'clamp(16px, 3vw, 20px)', ls: 4, mb: 8, ff: 'Cinzel, serif', fw: 600 },
    3: { fs: 'clamp(13px, 2.5vw, 16px)', ls: 3, mb: 6, ff: 'Cinzel, serif', fw: 600 },
  };
  const s = sizes[livello] || sizes[1];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: allineamento === 'center' ? 'center' : 'flex-start',
      gap: 14, marginBottom: s.mb, ...style,
    }}>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${colore})`, maxWidth: 120 }} />
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: s.ff, fontSize: s.fs, fontWeight: s.fw, letterSpacing: s.ls,
        color: colore,
        textShadow: glow ? `0 0 12px ${colore}80, 0 0 24px ${colore}40` : 'none',
        whiteSpace: 'nowrap',
      }}>
        <DiamanteOrn colore={colore} />
        <span>{children}</span>
        <DiamanteOrn colore={colore} />
      </div>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${colore})`, maxWidth: 120 }} />
      )}
    </div>
  );
}

function DiamanteOrn({ colore }) {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" style={{ flexShrink: 0 }}>
      <path d="M6,0 L12,6 L6,12 L0,6 Z" fill={colore} />
      <path d="M6,2 L10,6 L6,10 L2,6 Z" fill="rgba(0,0,0,0.4)" />
    </svg>
  );
}

// ============================================================
// BOTTONE DECORATO - stile Genshin/HSR
// ============================================================
export function BtnDecorato({ children, variant = 'primary', size = 'md', onClick, disabled = false, icon, style = {}, ...rest }) {
  const sizes = {
    sm: { px: 14, py: 6, fs: 11, ls: 2 },
    md: { px: 22, py: 10, fs: 12, ls: 3 },
    lg: { px: 32, py: 14, fs: 14, ls: 4 },
  };
  const variants = {
    primary: {
      bg: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #a855f7 100%)',
      bgHover: 'linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #c084fc 100%)',
      color: '#0a0515', border: '#f59e0b',
      shadow: '0 0 16px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
    },
    secondary: {
      bg: 'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(15,10,30,0.8))',
      bgHover: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(236,72,153,0.1))',
      color: '#f5e6d3', border: '#f59e0b80',
      shadow: '0 0 8px rgba(245,158,11,0.2)',
    },
    danger: {
      bg: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(0,0,0,0.6))',
      bgHover: 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(127,29,29,0.4))',
      color: '#fca5a5', border: '#ef444480',
      shadow: '0 0 8px rgba(239,68,68,0.3)',
    },
    success: {
      bg: 'linear-gradient(135deg, rgba(6,214,160,0.15), rgba(0,0,0,0.6))',
      bgHover: 'linear-gradient(135deg, rgba(6,214,160,0.3), rgba(4,120,87,0.4))',
      color: '#6ee7b7', border: '#06d6a080',
      shadow: '0 0 8px rgba(6,214,160,0.3)',
    },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = v.bgHover; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = v.bg; }}
      style={{
        position: 'relative',
        padding: `${s.py}px ${s.px}px`,
        background: v.bg, color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 3,
        fontFamily: 'Cinzel, serif', fontSize: s.fs, fontWeight: 700, letterSpacing: s.ls,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: v.shadow,
        transition: 'all 0.2s ease',
        textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ fontSize: s.fs * 1.3 }}>{icon}</span>}
      {children}
      {/* Mini diamante decorativo */}
      <span style={{
        position: 'absolute', top: -3, right: -3,
        width: 6, height: 6, transform: 'rotate(45deg)',
        background: v.border, opacity: 0.7,
      }} />
    </button>
  );
}

// ============================================================
// CHIP / TAG - per stati, rarità, etichette
// ============================================================
export function Chip({ children, colore = '#f59e0b', icon, size = 'sm' }) {
  const sizes = { xs: { px: 6, py: 2, fs: 9 }, sm: { px: 10, py: 3, fs: 10 }, md: { px: 14, py: 5, fs: 12 } };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${s.py}px ${s.px}px`,
      background: `linear-gradient(135deg, ${colore}25, ${colore}10)`,
      border: `1px solid ${colore}80`,
      borderRadius: 12,
      fontSize: s.fs, color: colore, letterSpacing: 1,
      fontWeight: 600, fontFamily: 'Cinzel, serif',
    }}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
}

// ============================================================
// BARRA RISORSA (energia, pacchetti) — stile HSR
// ============================================================
export function BarraRisorsa({ valore, max, colore = '#f59e0b', icon, label, mostraNumero = true }) {
  const pct = Math.max(0, Math.min(100, (valore / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: `radial-gradient(circle, ${colore}40, ${colore}10)`,
        border: `2px solid ${colore}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: colore,
        boxShadow: `0 0 10px ${colore}60`, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <div style={{ fontSize: 8, opacity: 0.6, letterSpacing: 2, fontFamily: 'Cinzel, serif' }}>{label.toUpperCase()}</div>}
        <div style={{
          height: 6, background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${colore}cc, ${colore})`,
            boxShadow: `0 0 8px ${colore}`,
            transition: 'width 0.4s ease',
          }} />
        </div>
        {mostraNumero && (
          <div style={{ fontSize: 10, color, fontFamily: 'Cinzel, serif', textAlign: 'right', marginTop: 2 }}>
            {valore}/{max}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CARD CONTENITORE - per griglie omogenee (statistiche, info)
// ============================================================
export function CardInfo({ children, colore = '#f59e0b', glow = true, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      padding: 14,
      background: `linear-gradient(160deg, ${colore}12, rgba(15,10,30,0.6))`,
      border: `1px solid ${colore}50`,
      borderRadius: 4,
      boxShadow: glow ? `0 0 16px ${colore}30, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.3s',
      ...style,
    }}
      onMouseEnter={onClick ? (e) => e.currentTarget.style.transform = 'translateY(-2px)' : undefined}
      onMouseLeave={onClick ? (e) => e.currentTarget.style.transform = 'translateY(0)' : undefined}
    >
      {/* Linea decorativa in alto */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '40%', height: 2,
        background: `linear-gradient(90deg, transparent, ${colore}, transparent)`,
      }} />
      {children}
    </div>
  );
}

// ============================================================
// DIVIDER ORNAMENTALE
// ============================================================
export function Divider({ colore = '#f59e0b', spazio = 16 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `${spazio}px 0`, gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${colore}80)` }} />
      <DiamanteOrn colore={colore} />
      <DiamanteOrn colore={colore} />
      <DiamanteOrn colore={colore} />
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${colore}80)` }} />
    </div>
  );
}

// ============================================================
// STELLE RARITA' decorate (per le carte)
// ============================================================
export function StelleRarita({ stelle, colore = '#f59e0b', dimensione = 14 }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[...Array(stelle)].map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={dimensione} height={dimensione} style={{ filter: `drop-shadow(0 0 3px ${colore})` }}>
          <path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17 L5.5 22 L8 14 L2 9 L9.5 9 Z"
                fill={colore} stroke={colore} strokeWidth="0.5" />
        </svg>
      ))}
    </div>
  );
}

// ============================================================
// FRAME PERSONAGGIO - per ritratti waifu (cornice ornata)
// ============================================================
export function FramePersonaggio({ children, colore = '#f59e0b', dimensione = 80 }) {
  return (
    <div style={{
      position: 'relative',
      width: dimensione, height: dimensione,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${colore}20, transparent 70%)`,
      border: `2px solid ${colore}`,
      boxShadow: `0 0 16px ${colore}80, inset 0 0 12px ${colore}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {children}
      {/* Ornamenti rotativi (statici, niente animazione) */}
      {[0, 90, 180, 270].map(deg => (
        <div key={deg} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 6, height: 6,
          background: colore,
          transform: `rotate(${deg}deg) translateY(-${dimensione / 2 + 3}px) rotate(45deg)`,
          transformOrigin: 'center',
          boxShadow: `0 0 6px ${colore}`,
        }} />
      ))}
    </div>
  );
}
