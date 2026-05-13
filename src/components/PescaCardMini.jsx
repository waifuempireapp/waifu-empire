'use client';

// Stessi colori di CartaWaifu
const RARITY_BORDER = {
  comune:      { outer: '#7a8694', inner: '#9ca3af', glow: 'rgba(156,163,175,0.35)', bg: 'linear-gradient(160deg, #1a1e24 0%, #0d1015 100%)' },
  raro:        { outer: '#2563eb', inner: '#60a5fa', glow: 'rgba(37,99,235,0.5)',     bg: 'linear-gradient(160deg, #0a1628 0%, #081020 100%)' },
  epico:       { outer: '#9333ea', inner: '#c084fc', glow: 'rgba(147,51,234,0.55)',   bg: 'linear-gradient(160deg, #1a0a30 0%, #100820 100%)' },
  leggendario: { outer: '#f59e0b', inner: '#fbbf24', glow: 'rgba(245,158,11,0.6)',    bg: 'linear-gradient(160deg, #2a1a05 0%, #1a1005 100%)' },
  immersivo:   { outer: '#ec4899', inner: '#f472b6', glow: 'rgba(236,72,153,0.65)',   bg: 'linear-gradient(160deg, #2a0520 0%, #1a0515 100%)' },
};

const TIPO_ICONA = { waifu: '◈', outfit: '✦', posa: '✿' };

// Badge NEW identico a quello dello Sbusto
export function BadgeNew({ style }) {
  return (
    <div style={{
      position: 'absolute', top: 6, right: 6,
      background: 'linear-gradient(135deg, #f5a623cc, #ff2d78cc)',
      color: '#fff',
      fontFamily: 'Orbitron, monospace',
      fontSize: 7, fontWeight: 900, letterSpacing: 1,
      padding: '2px 5px', borderRadius: 4,
      border: '1px solid rgba(255,255,255,0.35)',
      boxShadow: '0 0 8px rgba(245,166,35,0.5)',
      pointerEvents: 'none', zIndex: 10,
      textTransform: 'uppercase',
      ...style,
    }}>NEW!</div>
  );
}

// Badge HOT 🔥 — stesso stile di BadgeNew ma rosso-arancio
export function BadgeHot({ style }) {
  return (
    <div style={{
      position: 'absolute', top: 6, left: 6,
      background: 'linear-gradient(135deg, #ff4500cc, #ff8c00cc)',
      color: '#fff',
      fontFamily: 'Orbitron, monospace',
      fontSize: 7, fontWeight: 900, letterSpacing: 1,
      padding: '2px 5px', borderRadius: 4,
      border: '1px solid rgba(255,255,255,0.35)',
      boxShadow: '0 0 8px rgba(255,69,0,0.6)',
      pointerEvents: 'none', zIndex: 10,
      textTransform: 'uppercase',
      ...style,
    }}>HOT 🔥</div>
  );
}

// Carta con grafica identica alla collezione, dimensione configurabile
export default function PescaCardMini({ carta, isNew, isHot, width = 65, height = 92, copia }) {
  const rb = RARITY_BORDER[carta?.rarita] || RARITY_BORDER.comune;
  const scale = width / 65;

  return (
    <div style={{
      width, height, position: 'relative', flexShrink: 0,
      borderRadius: Math.round(8 * scale),
      border: `${width >= 100 ? 3 : 2}px solid ${rb.outer}`,
      boxShadow: `0 0 ${Math.round(18 * scale)}px ${rb.glow}, inset 0 0 ${Math.round(10 * scale)}px rgba(0,0,0,0.4)`,
      background: rb.bg,
      overflow: 'hidden',
      cursor: 'default',
    }}>
      {/* Bordo interno luminoso (stile CartaWaifu) */}
      <div style={{
        position: 'absolute', inset: Math.round(2 * scale),
        borderRadius: Math.round(6 * scale),
        border: `1px solid ${rb.inner}30`,
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* Immagine full-art */}
      {carta?.immagine ? (
        <img
          src={carta.immagine}
          alt={carta.nome || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(22 * scale), color: rb.outer, opacity: 0.7,
        }}>
          {TIPO_ICONA[carta?.tipo] || '◈'}
        </div>
      )}

      {/* Footer sfumato con nome */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
        padding: `${Math.round(8 * scale)}px ${Math.round(4 * scale)}px ${Math.round(3 * scale)}px`,
        zIndex: 4,
      }}>
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: Math.max(5, Math.round(6 * scale)),
          fontWeight: 700, color: rb.inner,
          letterSpacing: 0.3, lineHeight: 1.2,
          textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
          textShadow: `0 0 5px ${rb.outer}`,
        }}>
          {carta?.nome}
        </div>
      </div>

      {/* Badge NEW! — stile identico a Sbusto (top right) */}
      {isNew && <BadgeNew />}

      {/* Badge HOT 🔥 — top left; se c'è anche NEW sposta leggermente */}
      {isHot && <BadgeHot style={isNew ? { top: 20 } : {}} />}

      {/* Contatore copie (opzionale) */}
      {copia !== undefined && (
        <div style={{
          position: 'absolute', top: 4, left: 4,
          background: copia === 0 ? 'rgba(0,230,118,0.2)' : 'rgba(0,0,0,0.6)',
          border: `1px solid ${copia === 0 ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 20, minWidth: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Orbitron', fontSize: Math.max(6, Math.round(7 * scale)),
          fontWeight: 700, color: copia === 0 ? '#00e676' : '#eedcd4',
          paddingInline: 4, zIndex: 5,
        }}>
          {copia}
        </div>
      )}
    </div>
  );
}
