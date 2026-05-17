'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { CartaWaifu } from '@/components/CartaWaifu';

export default function BattleModal({ pixel, collezione, waifuCat, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const ownedWaifu = Object.entries(collezione?.waifu || {})
    .map(([id]) => waifuCat?.find(w => w.id === id))
    .filter(Boolean);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>◆ CONQUISTA</div>
          <div style={{ fontFamily: FF.display, fontSize: 18, color: '#fff', fontWeight: 800 }}>Scegli il tuo team</div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
            Attacchi pixel ({pixel?.x}, {pixel?.y}) · {selectedIds.length}/5 selezionate
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {ownedWaifu.map(w => {
            const sel = selectedIds.includes(w.id);
            return (
              <div
                key={w.id}
                onClick={() => toggleSelect(w.id)}
                style={{
                  position: 'relative', cursor: 'pointer', borderRadius: 12,
                  border: `2px solid ${sel ? C.gold : 'rgba(174,156,255,0.15)'}`,
                  boxShadow: sel ? `0 0 14px ${C.gold}40` : 'none',
                  transition: 'all 0.15s',
                  overflow: 'hidden',
                }}
              >
                <CartaWaifu waifu={w} variant="waifu" size="sm" />
                {sel && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: C.gold, color: '#1a0024',
                    display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 13,
                  }}>{selectedIds.indexOf(w.id) + 1}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '16px 20px 32px' }}>
        <button
          onClick={() => selectedIds.length === 5 && onConfirm(selectedIds)}
          disabled={selectedIds.length !== 5}
          style={{
            width: '100%', padding: '14px',
            background: selectedIds.length === 5
              ? 'linear-gradient(135deg, #c54a86, #ff85b6)'
              : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: 14, cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: 13, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
          }}
        >
          {selectedIds.length === 5 ? '⚔ Avvia Battaglia' : `Seleziona ${5 - selectedIds.length} waifu`}
        </button>
      </div>
    </div>
  );
}
