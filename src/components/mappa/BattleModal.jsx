'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { RARITA } from '@/lib/constants';

// Card compatta dedicata alla selezione team — più piccola di CartaWaifu standard
function MiniWaifuCard({ waifu, selIdx, onClick }) {
  const sel = selIdx !== -1;
  const rarColor = {
    comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
    leggendario: '#ffc861', immersivo: '#ff7eb6',
  }[waifu.rarita] ?? '#b4bcc8';

  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', borderRadius: 12,
      border: `2px solid ${sel ? rarColor : 'rgba(174,156,255,0.12)'}`,
      boxShadow: sel ? `0 0 14px ${rarColor}50` : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      overflow: 'hidden', background: '#12102a',
      aspectRatio: '3/4',
    }}>
      {/* Immagine waifu */}
      {waifu.asset_immagine ? (
        <img
          src={waifu.asset_immagine}
          alt={waifu.nome}
          style={{ width: '100%', height: '75%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '75%', background: `${rarColor}22`, display: 'grid', placeItems: 'center' }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>♛</span>
        </div>
      )}

      {/* Nome + rarità */}
      <div style={{
        padding: '4px 6px', height: '25%',
        background: 'linear-gradient(transparent, rgba(3,2,12,0.95))',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: FF.body, fontSize: 9, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600,
        }}>{waifu.nome}</div>
        <div style={{ fontFamily: FF.label, fontSize: 7, color: rarColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
          {waifu.rarita}
        </div>
      </div>

      {/* Badge posizione selezione */}
      {sel && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          width: 20, height: 20, borderRadius: '50%',
          background: rarColor, color: '#0d0a26',
          display: 'grid', placeItems: 'center',
          fontWeight: 900, fontSize: 11, zIndex: 2,
          boxShadow: `0 2px 8px ${rarColor}80`,
        }}>{selIdx + 1}</div>
      )}
    </div>
  );
}

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
      background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>◆ CONQUISTA</div>
          <div style={{ fontFamily: FF.display, fontSize: 17, color: '#fff', fontWeight: 800 }}>Scegli il tuo team</div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
            pixel ({pixel?.x}, {pixel?.y}) · {selectedIds.length}/5
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Griglia waifu */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ownedWaifu.map(w => (
            <MiniWaifuCard
              key={w.id}
              waifu={w}
              selIdx={selectedIds.indexOf(w.id)}
              onClick={() => toggle(w.id)}
            />
          ))}
        </div>
      </div>

      {/* Bottone conferma */}
      <div style={{ padding: '14px 16px 30px', flexShrink: 0 }}>
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
            textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.2s',
          }}
        >
          {selectedIds.length === 5 ? '⚔ Avvia Battaglia' : `Seleziona ancora ${5 - selectedIds.length}`}
        </button>
      </div>
    </div>
  );
}
