'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { CartaWaifu } from '@/components/CartaWaifu';

export default function BattleModal({ pixel, collezione, waifuCat, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const ownedWaifu = Object.entries(collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = waifuCat?.find(x => x.id === id);
      return w ? { ...w, ...dati } : null;
    })
    .filter(Boolean);

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>◆ CONQUISTA</div>
          <div style={{ fontFamily: FF.display, fontSize: 18, color: '#fff', fontWeight: 800 }}>Scegli il tuo team</div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 3 }}>
            Pixel ({pixel?.x}, {pixel?.y}) · {selectedIds.length}/5 selezionate
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer', paddingTop: 4 }}>✕</button>
      </div>

      {/* Griglia waifu — dimensione 'normale' come in Collezione, 3 colonne */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {ownedWaifu.map(w => {
            const sel = selectedIds.includes(w.id);
            return (
              <div
                key={w.id}
                onClick={() => toggle(w.id)}
                style={{
                  position: 'relative', cursor: 'pointer', borderRadius: 14,
                  outline: sel ? `3px solid ${C.gold}` : '3px solid transparent',
                  boxShadow: sel ? `0 0 18px ${C.gold}50` : 'none',
                  transition: 'outline 0.15s, box-shadow 0.15s',
                }}
              >
                <CartaWaifu waifu={w} dimensione="piccola" />
                {/* Badge numero selezione */}
                {sel && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    width: 24, height: 24, borderRadius: '50%',
                    background: C.gold, color: '#1a0024',
                    display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 13,
                    boxShadow: `0 2px 8px ${C.gold}80`,
                  }}>{selectedIds.indexOf(w.id) + 1}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottone conferma */}
      <div style={{ padding: '12px 16px 32px', flexShrink: 0 }}>
        <button
          onClick={() => selectedIds.length === 5 && onConfirm(selectedIds)}
          disabled={selectedIds.length !== 5}
          style={{
            width: '100%', padding: '15px',
            background: selectedIds.length === 5
              ? 'linear-gradient(135deg, #c54a86, #ff85b6)'
              : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: 14,
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: 14, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
            transition: 'all 0.2s',
          }}
        >
          {selectedIds.length === 5 ? '⚔ Avvia Battaglia' : `Seleziona ${5 - selectedIds.length} waifu`}
        </button>
      </div>
    </div>
  );
}
