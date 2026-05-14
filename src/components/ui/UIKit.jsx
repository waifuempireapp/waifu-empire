// src/components/ui/UIKit.jsx
// IMPERO DELLE WAIFU — Redesign · UI Kit
// Tutti gli export e le props sono identici alla versione precedente:
//   PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
//   BarraRisorsa, CardInfo, Divider, StelleRarita, FramePersonaggio
// Solo il linguaggio visivo è stato rinnovato (premium gacha night).
'use client';
import React from 'react';

// ============================================================
// PANNELLO — Glassmorphism notturno con bordi neon
// ============================================================
export function PannelloOrnato({ children, variant = 'default', glow = '#f5c560', style = {}, ...rest }) {
  const variants = {
    default: { bg: 'linear-gradient(180deg, rgba(27,22,56,0.72), rgba(13,10,38,0.85))', border: 'rgba(174,156,255,0.18)' },
    dark:    { bg: 'linear-gradient(180deg, rgba(7,5,26,0.92), rgba(3,2,12,0.96))',     border: 'rgba(174,156,255,0.10)' },
    accent:  { bg: 'linear-gradient(180deg, rgba(245,197,96,0.10), rgba(245,197,96,0.04))', border: 'rgba(245,197,96,0.45)' },
    purple:  { bg: 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(13,10,38,0.85))', border: 'rgba(167,139,250,0.35)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <div style={{
      position: 'relative',
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 16,
      padding: 18,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: `0 0 28px ${glow}1a, 0 10px 36px rgba(3,2,12,0.55), 0 1px 0 rgba(255,255,255,0.04) inset`,
      ...style,
    }} {...rest}>
      <CornerBrackets colore={glow} />
      {children}
    </div>
  );
}

function CornerBrackets({ colore }) {
  const sz = 14;
  const positions = [
    { top: -1, left: -1, r: 0 },
    { top: -1, right: -1, r: 90 },
    { bottom: -1, right: -1, r: 180 },
    { bottom: -1, left: -1, r: 270 },
  ];
  return positions.map((pos, i) => (
    <svg key={i} viewBox="0 0 16 16" width={sz} height={sz}
      style={{ position: 'absolute', transform: `rotate(${pos.r}deg)`, pointerEvents: 'none', ...pos }}>
      <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" fill={colore} opacity="0.55" />
    </svg>
  ));
}

// ============================================================
// TITOLO — Display font + linee laterali sottili
// ============================================================
export function TitoloOrnato({ children, livello = 1, colore = '#f5c560', glow = true, allineamento = 'center', style = {} }) {
  const sizes = {
    1: { fs: 'clamp(20px, 3.8vw, 30px)', ls: 0,    mb: 12, fw: 800 },
    2: { fs: 'clamp(15px, 2.6vw, 20px)', ls: 0.5,  mb: 9,  fw: 700 },
    3: { fs: 'clamp(12px, 2vw, 15px)',   ls: 1.5,  mb: 7,  fw: 700 },
  };
  const s = sizes[livello] || sizes[1];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: allineamento === 'center' ? 'center' : 'flex-start',
      gap: 14, marginBottom: s.mb, ...style,
    }}>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, maxWidth: 110,
          background: `linear-gradient(90deg, transparent, ${colore}66)` }} />
      )}
      <div style={{
        fontFamily: "var(--ff-display, 'Unbounded', sans-serif)",
        fontSize: s.fs, fontWeight: s.fw, letterSpacing: s.ls,
        color: colore,
        textShadow: glow ? `0 0 18px ${colore}55, 0 0 32px ${colore}22` : 'none',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, maxWidth: 110,
          background: `linear-gradient(270deg, transparent, ${colore}66)` }} />
      )}
    </div>
  );
}

// ============================================================
// BOTTONE — Crystal style
// ============================================================
export function BtnDecorato({ children, variant = 'primary', size = 'md', onClick, disabled = false, icon, style = {}, ...rest }) {
  const sizes = {
    sm: { px: 14, py: 7,  fs: 10, ls: 1.5, br: 9  },
    md: { px: 20, py: 11, fs: 12, ls: 2,   br: 11 },
    lg: { px: 28, py: 15, fs: 14, ls: 2.5, br: 13 },
  };
  const variants = {
    primary: {
      bg:      'linear-gradient(180deg, rgba(245,197,96,0.32), rgba(245,197,96,0.10))',
      bgHover: 'linear-gradient(180deg, rgba(255,233,168,0.45), rgba(245,197,96,0.18))',
      color: '#2a1f00',
      border: 'rgba(255,233,168,0.6)',
      shadow:
        '0 1px 0 rgba(255,255,255,0.55) inset, ' +
        '0 -10px 20px rgba(192,138,31,0.45) inset, ' +
        '0 8px 24px rgba(245,197,96,0.35)',
    },
    secondary: {
      bg:      'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
      bgHover: 'linear-gradient(180deg, rgba(245,197,96,0.18), rgba(245,197,96,0.04))',
      color: '#f1ebff',
      border: 'rgba(255,255,255,0.16)',
      shadow:
        '0 1px 0 rgba(255,255,255,0.12) inset, ' +
        '0 -8px 16px rgba(0,0,0,0.4) inset, ' +
        '0 6px 20px rgba(0,0,0,0.45)',
    },
    danger: {
      bg:      'linear-gradient(180deg, rgba(255,91,108,0.20), rgba(255,91,108,0.06))',
      bgHover: 'linear-gradient(180deg, rgba(255,91,108,0.38), rgba(255,91,108,0.10))',
      color: '#ffa8b0',
      border: 'rgba(255,91,108,0.45)',
      shadow:
        '0 1px 0 rgba(255,255,255,0.10) inset, ' +
        '0 -8px 18px rgba(120,20,40,0.5) inset, ' +
        '0 6px 18px rgba(255,91,108,0.25)',
    },
    success: {
      bg:      'linear-gradient(180deg, rgba(88,224,163,0.22), rgba(88,224,163,0.06))',
      bgHover: 'linear-gradient(180deg, rgba(88,224,163,0.40), rgba(88,224,163,0.10))',
      color: '#a8f5cf',
      border: 'rgba(88,224,163,0.50)',
      shadow:
        '0 1px 0 rgba(255,255,255,0.10) inset, ' +
        '0 -8px 18px rgba(20,90,60,0.5) inset, ' +
        '0 6px 18px rgba(88,224,163,0.22)',
    },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = v.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = v.bg; e.currentTarget.style.transform = 'translateY(0)'; } }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      style={{
        position: 'relative',
        padding: `${s.py}px ${s.px}px`,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: s.br,
        fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
        fontSize: s.fs,
        fontWeight: 700,
        letterSpacing: `${s.ls}px`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        boxShadow: v.shadow,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.2s ease, transform 0.15s ease',
        textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {/* Riflesso obliquo */}
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
        opacity: 0.55,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }} />
      {icon && <span style={{ position: 'relative', fontSize: s.fs * 1.2, lineHeight: 1 }}>{icon}</span>}
      <span style={{ position: 'relative' }}>{children}</span>
    </button>
  );
}

// ============================================================
// CHIP / TAG
// ============================================================
export function Chip({ children, colore = '#f5c560', icon, size = 'sm' }) {
  const sizes = {
    xs: { px: 7, py: 2, fs: 9 },
    sm: { px: 10, py: 3, fs: 10 },
    md: { px: 14, py: 5, fs: 12 },
  };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: `${s.py}px ${s.px}px`,
      background: `${colore}13`,
      border: `1px solid ${colore}55`,
      borderRadius: 999,
      fontSize: s.fs, color: colore,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontWeight: 700,
      fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}

// ============================================================
// BARRA RISORSA — Pill clean con glow proporzionale
// ============================================================
export function BarraRisorsa({ valore, max, colore = '#f5c560', icon, label, mostraNumero = true }) {
  const pct = Math.max(0, Math.min(100, (valore / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 110 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 10,
        background: `${colore}1a`,
        border: `1.5px solid ${colore}88`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: colore,
        boxShadow: `0 0 10px ${colore}44, 0 0 0 1px rgba(255,255,255,0.04) inset`,
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && (
          <div style={{
            fontSize: 8, opacity: 0.55, letterSpacing: '0.22em',
            fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)",
            textTransform: 'uppercase',
          }}>{label}</div>
        )}
        <div style={{
          height: 6, background: 'rgba(7,5,26,0.6)',
          borderRadius: 999, position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${colore}bb, ${colore})`,
            boxShadow: `0 0 8px ${colore}`,
            transition: 'width 0.4s ease', borderRadius: 999,
          }} />
        </div>
        {mostraNumero && (
          <div style={{
            fontSize: 10, color: colore,
            fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)",
            fontWeight: 700,
            textAlign: 'right', marginTop: 2, letterSpacing: '-0.01em',
          }}>
            {valore}/{max}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CARD INFO — Statistiche, sintesi
// ============================================================
export function CardInfo({ children, colore = '#f5c560', glow = true, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      padding: 14,
      background: `linear-gradient(180deg, ${colore}10, ${colore}04)`,
      border: `1px solid ${colore}30`,
      borderRadius: 14,
      boxShadow: glow ? `0 0 14px ${colore}1f, 0 4px 14px rgba(3,2,12,0.4)` : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      ...style,
    }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = `${colore}66`;
        e.currentTarget.style.boxShadow = `0 0 22px ${colore}33, 0 8px 24px rgba(3,2,12,0.5)`;
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = `${colore}30`;
        e.currentTarget.style.boxShadow = glow ? `0 0 14px ${colore}1f, 0 4px 14px rgba(3,2,12,0.4)` : 'none';
      } : undefined}
    >
      {children}
    </div>
  );
}

// ============================================================
// DIVIDER — Linea + diamante
// ============================================================
export function Divider({ colore = '#f5c560', spazio = 14 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: `${spazio}px 0`, gap: 10,
    }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${colore}50)` }} />
      <svg viewBox="0 0 8 8" width="7" height="7">
        <path d="M4,0 L8,4 L4,8 L0,4 Z" fill={colore} opacity="0.55" />
      </svg>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${colore}50)` }} />
    </div>
  );
}

// ============================================================
// STELLE RARITÀ
// ============================================================
export function StelleRarita({ stelle, colore = '#f5c560', dimensione = 12 }) {
  return (
    <div style={{ display: 'inline-flex', gap: 1 }}>
      {[...Array(stelle)].map((_, i) => (
        <span key={i} style={{
          color: colore, fontSize: dimensione,
          filter: `drop-shadow(0 0 4px ${colore})`,
        }}>★</span>
      ))}
    </div>
  );
}

// ============================================================
// FRAME PERSONAGGIO — Cerchio con glow per avatar
// ============================================================
export function FramePersonaggio({ children, colore = '#f5c560', dimensione = 80 }) {
  return (
    <div style={{
      position: 'relative',
      width: dimensione, height: dimensione,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${colore}25, rgba(7,5,26,0.85))`,
      border: `2px solid ${colore}aa`,
      boxShadow: `0 0 16px ${colore}55, inset 0 0 12px rgba(0,0,0,0.3)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Inner ring */}
      <div style={{
        position: 'absolute', inset: 3, borderRadius: '50%',
        border: `1px solid ${colore}33`,
        pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}
