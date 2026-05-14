// src/app/gioco/_redesign/_shared.jsx
// Token visivi condivisi tra le schermate del modulo redesign.
'use client';
import React from 'react';

// ---- COLORI BRAND ----
export const C = {
  ink:     '#03020c',
  ink2:    '#0d0a26',
  inkLine: 'rgba(174,156,255,0.18)',
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
};

// ---- FAMIGLIE FONT ----
export const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
};

// ---- SAKURA PETALS OVERLAY ----
export function Sakura({ count = 8 }) {
  const petals = Array.from({ length: count }).map((_, i) => ({
    left: (i * 83) % 100,
    delay: (i * 0.7) % 8,
    dur: 14 + (i % 5),
    size: 6 + (i % 4) * 2,
  }));
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden', zIndex: 0,
    }}>
      {petals.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: -20, left: `${p.left}%`,
          width: p.size, height: p.size,
          borderRadius: '50% 0 50% 50%',
          background: 'linear-gradient(135deg, #ffc3da, #ff85b6)',
          opacity: 0.45,
          transform: 'rotate(45deg)',
          animation: `sakuraFall ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes sakuraFall {
          0%   { transform: translateY(0) rotate(45deg); opacity: 0; }
          10%  { opacity: 0.45; }
          90%  { opacity: 0.3; }
          100% { transform: translateY(110vh) rotate(405deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ---- KICKER + TITLE block ----
export function ScreenTitle({ kicker, title, sub, color = C.gold }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {kicker && (
        <div style={{
          fontFamily: FF.label, fontSize: 10, letterSpacing: '0.42em',
          color, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700,
        }}>◆ {kicker}</div>
      )}
      <h1 style={{
        fontFamily: FF.display,
        fontSize: 'clamp(22px, 5vw, 32px)',
        fontWeight: 800,
        margin: 0, letterSpacing: '-0.01em', lineHeight: 0.95,
        color: '#fff',
      }}>{title}</h1>
      {sub && (
        <div style={{
          fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.6)',
          marginTop: 6, lineHeight: 1.4,
        }}>{sub}</div>
      )}
    </div>
  );
}

// ---- SUB TAB SELECTOR (uniformato) ----
export function SubTabBar({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {tabs.map(t => {
        const active = value === t.value;
        return (
          <button key={t.value} onClick={() => onChange(t.value)} style={{
            flex: 1, padding: '9px 0', position: 'relative',
            background: active
              ? 'linear-gradient(180deg, rgba(245,197,96,0.32), rgba(245,197,96,0.10))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            color: active ? '#2a1f00' : 'var(--text-dim, #b6aed6)',
            border: `1px solid ${active ? 'rgba(255,233,168,0.6)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 11,
            fontFamily: FF.label, fontSize: 10, letterSpacing: '0.18em',
            fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: active
              ? '0 1px 0 rgba(255,255,255,0.55) inset, 0 -10px 20px rgba(192,138,31,0.45) inset, 0 8px 24px rgba(245,197,96,0.35)'
              : 'none',
            overflow: 'hidden',
          }}>
            {active && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
                opacity: 0.55, mixBlendMode: 'overlay', pointerEvents: 'none',
              }}/>
            )}
            <span style={{ position: 'relative' }}>{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 6, zIndex: 1,
                background: C.err, color: '#fff', borderRadius: 999,
                minWidth: 16, height: 16, padding: '0 4px',
                fontSize: 9, fontFamily: FF.mono, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 8px rgba(255,91,108,0.6)',
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- LIST ITEM (riga uniforme per liste come amici, classifica) ----
export function ListItem({ children, accent, active, onClick, style = {} }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: active
        ? `linear-gradient(90deg, ${accent || C.gold}1a, transparent)`
        : 'transparent',
      borderLeft: active ? `3px solid ${accent || C.gold}` : '3px solid transparent',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.18s, transform 0.15s',
      ...style,
    }}>{children}</div>
  );
}
