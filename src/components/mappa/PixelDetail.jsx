'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

export default function PixelDetail({ pixel, userUid, waifuCat, onAttack, onPurchase, onEditDefense, onClose }) {
  const [loading, setLoading] = useState(false);
  if (!pixel) return null;

  const isOwn = pixel.ownerId === userUid;
  const isCPU = pixel.ownerId === 'CPU';
  const price = 200 + ((pixel.ownerLevel ?? 1) * 50);

  const defenseTeam = pixel.defenseTeam || [];
  const defenseWaifu = defenseTeam
    .map(id => waifuCat?.find(w => w.id === id))
    .filter(Boolean);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(7,5,26,0.97)', backdropFilter: 'blur(20px)',
      borderTop: `1px solid rgba(174,156,255,0.22)`,
      borderRadius: '20px 20px 0 0',
      padding: '20px 20px 32px',
      boxShadow: '0 -8px 40px rgba(3,2,12,0.7)',
      animation: 'slideUp 0.25s ease-out',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* Handle + close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(174,156,255,0.2)', margin: '0 auto' }} />
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 0 }}>✕</button>
      </div>

      {/* Coordinate + proprietario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: pixel.ownerColor || '#888888',
          border: '2px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 11, letterSpacing: '0.2em', color: C.goldL, textTransform: 'uppercase' }}>
            {pixel.ownerName || 'CPU'}
          </div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
            pixel ({pixel.x}, {pixel.y})
          </div>
        </div>
      </div>

      {/* Team difensore (mini icone) */}
      {defenseWaifu.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.6)', textTransform: 'uppercase', marginBottom: 8 }}>
            Team difensore
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {defenseWaifu.map((w, i) => (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(174,156,255,0.2)',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {w.asset_immagine && (
                  <img src={w.asset_immagine} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - defenseWaifu.length) }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(174,156,255,0.15)',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Azioni */}
      <div style={{ display: 'flex', gap: 10 }}>
        {isOwn ? (
          <button onClick={onEditDefense} style={btnStyle(C.violet, 'rgba(167,139,250,0.12)')}>
            ⚔ Modifica Difesa
          </button>
        ) : (
          <>
            <button onClick={() => { setLoading(true); onAttack?.(); }} disabled={loading} style={btnStyle(C.sakura, 'rgba(255,133,182,0.12)')}>
              ⚔ Attacca
            </button>
            <button onClick={() => { setLoading(true); onPurchase?.({ price }); }} disabled={loading} style={btnStyle(C.gold, 'rgba(245,197,96,0.12)')}>
              💋 {isCPU ? `${price}K` : 'Offri'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(color, bg) {
  return {
    flex: 1, padding: '12px 8px',
    background: bg,
    border: `1px solid ${color}55`,
    borderRadius: 12, color,
    fontFamily: "'Saira Condensed', sans-serif",
    fontSize: 12, letterSpacing: '0.18em',
    textTransform: 'uppercase', fontWeight: 700,
    cursor: 'pointer',
  };
}
