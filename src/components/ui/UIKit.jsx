// src/components/ui/UIKit.jsx
// UI Kit reworkato — stile ispirato ai modal overlay scelta statistiche/direzione battaglia
// Design: glassmorphism + bordi angolari neon + tipografia Orbitron
'use client';
import React from 'react';

// ============================================================
// PANNELLO — Glassmorphism con bordi angolari
// ============================================================
export function PannelloOrnato({ children, variant = 'default', glow = '#f5a623', style = {}, ...rest }) {
  const variants = {
    default: { bg: 'rgba(12,6,24,0.85)', border: 'rgba(245,166,35,0.25)' },
    dark:    { bg: 'rgba(6,3,15,0.92)', border: 'rgba(245,166,35,0.15)' },
    accent:  { bg: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.45)' },
    purple:  { bg: 'rgba(155,89,255,0.08)', border: 'rgba(155,89,255,0.35)' },
  };
  const v = variants[variant] || variants.default;
  return (
    <div style={{
      position: 'relative',
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 12,
      padding: 18,
      backdropFilter: 'blur(16px)',
      boxShadow: `0 0 24px ${glow}15, 0 8px 32px rgba(0,0,0,0.3)`,
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
      <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" fill={colore} opacity="0.6" />
    </svg>
  ));
}

// ============================================================
// TITOLO — Con linee laterali e diamanti
// ============================================================
export function TitoloOrnato({ children, livello = 1, colore = '#f5a623', glow = true, allineamento = 'center', style = {} }) {
  const sizes = {
    1: { fs: 'clamp(18px, 3.5vw, 26px)', ls: 4, mb: 10, ff: 'Orbitron, sans-serif', fw: 700 },
    2: { fs: 'clamp(14px, 2.5vw, 18px)', ls: 3, mb: 8, ff: 'Orbitron, sans-serif', fw: 600 },
    3: { fs: 'clamp(11px, 2vw, 14px)', ls: 2, mb: 6, ff: 'Orbitron, sans-serif', fw: 600 },
  };
  const s = sizes[livello] || sizes[1];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: allineamento === 'center' ? 'center' : 'flex-start',
      gap: 12, marginBottom: s.mb, ...style,
    }}>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${colore}60)`, maxWidth: 100 }} />
      )}
      <div style={{
        fontFamily: s.ff, fontSize: s.fs, fontWeight: s.fw, letterSpacing: s.ls,
        color: colore,
        textShadow: glow ? `0 0 14px ${colore}60, 0 0 28px ${colore}25` : 'none',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
      {allineamento === 'center' && (
        <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${colore}60)`, maxWidth: 100 }} />
      )}
    </div>
  );
}

// ============================================================
// BOTTONE — Stile overlay modale battaglia
// ============================================================
export function BtnDecorato({ children, variant = 'primary', size = 'md', onClick, disabled = false, icon, style = {}, ...rest }) {
  const sizes = {
    sm: { px: 14, py: 7, fs: 10, ls: 1.5, br: 8 },
    md: { px: 20, py: 10, fs: 12, ls: 2, br: 10 },
    lg: { px: 28, py: 14, fs: 14, ls: 3, br: 12 },
  };
  const variants = {
    primary: {
      bg: 'linear-gradient(135deg, #f5a623 0%, #ff2d78 60%, #9b59ff 100%)',
      bgHover: 'linear-gradient(135deg, #ffd666 0%, #ff5a9e 60%, #b07aff 100%)',
      color: '#000', border: 'transparent',
      shadow: '0 4px 16px rgba(245,166,35,0.4)',
    },
    secondary: {
      bg: 'rgba(255,255,255,0.04)',
      bgHover: 'rgba(245,166,35,0.12)',
      color: '#eee8dc', border: 'rgba(245,166,35,0.3)',
      shadow: 'none',
    },
    danger: {
      bg: 'rgba(255,61,61,0.1)',
      bgHover: 'rgba(255,61,61,0.25)',
      color: '#ff8a8a', border: 'rgba(255,61,61,0.35)',
      shadow: 'none',
    },
    success: {
      bg: 'rgba(0,230,118,0.1)',
      bgHover: 'rgba(0,230,118,0.25)',
      color: '#69f0ae', border: 'rgba(0,230,118,0.35)',
      shadow: 'none',
    },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;

  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = v.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = v.bg; e.currentTarget.style.transform = 'translateY(0)'; } }}
      style={{
        padding: `${s.py}px ${s.px}px`,
        background: v.bg, color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: s.br,
        fontFamily: 'Orbitron, sans-serif', fontSize: s.fs, fontWeight: 700, letterSpacing: s.ls,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        boxShadow: v.shadow,
        transition: 'all 0.2s ease',
        textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ fontSize: s.fs * 1.2 }}>{icon}</span>}
      {children}
    </button>
  );
}

// ============================================================
// CHIP / TAG
// ============================================================
export function Chip({ children, colore = '#f5a623', icon, size = 'sm' }) {
  const sizes = { xs: { px: 6, py: 2, fs: 8 }, sm: { px: 10, py: 3, fs: 10 }, md: { px: 14, py: 5, fs: 12 } };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${s.py}px ${s.px}px`,
      background: `${colore}12`,
      border: `1px solid ${colore}50`,
      borderRadius: 20,
      fontSize: s.fs, color: colore, letterSpacing: 1,
      fontWeight: 600, fontFamily: 'Orbitron, sans-serif',
    }}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
}

// ============================================================
// BARRA RISORSA — Clean style
// ============================================================
export function BarraRisorsa({ valore, max, colore = '#f5a623', icon, label, mostraNumero = true }) {
  const pct = Math.max(0, Math.min(100, (valore / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: `${colore}15`,
        border: `1.5px solid ${colore}80`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: colore,
        boxShadow: `0 0 8px ${colore}40`, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <div style={{ fontSize: 7, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase' }}>{label}</div>}
        <div style={{
          height: 5, background: 'rgba(0,0,0,0.5)',
          borderRadius: 3, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${colore}aa, ${colore})`,
            boxShadow: `0 0 6px ${colore}`,
            transition: 'width 0.4s ease', borderRadius: 3,
          }} />
        </div>
        {mostraNumero && (
          <div style={{ fontSize: 9, color: colore, fontFamily: 'Orbitron, sans-serif', textAlign: 'right', marginTop: 1 }}>
            {valore}/{max}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CARD INFO — Per griglie statistiche
// ============================================================
export function CardInfo({ children, colore = '#f5a623', glow = true, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      padding: 14,
      background: `${colore}08`,
      border: `1px solid ${colore}25`,
      borderRadius: 12,
      boxShadow: glow ? `0 0 12px ${colore}15` : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.3s',
      ...style,
    }}
      onMouseEnter={onClick ? (e) => e.currentTarget.style.transform = 'translateY(-2px)' : undefined}
      onMouseLeave={onClick ? (e) => e.currentTarget.style.transform = 'translateY(0)' : undefined}
    >
      {children}
    </div>
  );
}

// ============================================================
// DIVIDER
// ============================================================
export function Divider({ colore = '#f5a623', spazio = 14 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `${spazio}px 0`, gap: 8 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${colore}40)` }} />
      <svg viewBox="0 0 8 8" width="6" height="6"><path d="M4,0 L8,4 L4,8 L0,4 Z" fill={colore} opacity="0.5" /></svg>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, transparent, ${colore}40)` }} />
    </div>
  );
}

// ============================================================
// STELLE RARITÀ
// ============================================================
export function StelleRarita({ stelle, colore = '#f5a623', dimensione = 12 }) {
  return (
    <div style={{ display: 'inline-flex', gap: 1 }}>
      {[...Array(stelle)].map((_, i) => (
        <span key={i} style={{ color: colore, fontSize: dimensione, filter: `drop-shadow(0 0 3px ${colore})` }}>★</span>
      ))}
    </div>
  );
}

// ============================================================
// FRAME PERSONAGGIO
// ============================================================
export function FramePersonaggio({ children, colore = '#f5a623', dimensione = 80 }) {
  return (
    <div style={{
      position: 'relative',
      width: dimensione, height: dimensione,
      borderRadius: '50%',
      background: `${colore}12`,
      border: `2px solid ${colore}80`,
      boxShadow: `0 0 12px ${colore}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}
