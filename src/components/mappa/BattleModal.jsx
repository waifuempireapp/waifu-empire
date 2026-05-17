'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { CartaWaifu } from '@/components/CartaWaifu';

export default function BattleModal({ pixel, collezione, waifuCat, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);

  const teams = collezione?.teams || {};
  const presets = Object.entries(teams).filter(([, t]) => t.waifu?.length === 5);

  const ownedWaifu = Object.entries(collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = waifuCat?.find(x => x.id === id);
      return w ? { ...w, ...dati, _datiColl: dati } : null;
    })
    .filter(Boolean);

  const toggle = (id) => {
    setActivePresetId(null);
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const selectPreset = (presetId, presetWaifu) => {
    const valid = presetWaifu.filter(id => ownedWaifu.some(w => w.id === id));
    if (valid.length === 5) { setSelectedIds(valid); setActivePresetId(presetId); }
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
            {pixel?.name || `(${pixel?.x}, ${pixel?.y})`} · {selectedIds.length}/5
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {/* Preset team salvati */}
        {presets.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.55)', textTransform: 'uppercase', marginBottom: 8 }}>⚡ Team salvati</div>
            {presets.map(([id, preset]) => {
              const w5 = (preset.waifu || []).map(wid => waifuCat?.find(w => w.id === wid)).filter(Boolean);
              const isActive = activePresetId === id;
              return (
                <div key={id} onClick={() => selectPreset(id, preset.waifu)} style={{
                  padding: '8px 12px', borderRadius: 12, cursor: 'pointer', marginBottom: 6,
                  background: isActive ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? C.violet : 'rgba(174,156,255,0.15)'}`,
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                }}>
                  <div style={{ fontFamily: FF.label, fontSize: 10, color: isActive ? C.violet : 'rgba(241,235,255,0.7)', textTransform: 'uppercase', minWidth: 60 }}>{preset.nome}</div>
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {w5.map((w, i) => (
                      <div key={i} style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', border: `1px solid ${isActive ? C.violet + '60' : 'rgba(174,156,255,0.15)'}` }}>
                        {(w.asset_immagine || w.asset_statica) && <img src={w.asset_immagine || w.asset_statica} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />}
                      </div>
                    ))}
                  </div>
                  <span style={{ color: isActive ? C.violet : 'rgba(174,156,255,0.3)', fontSize: 14 }}>{isActive ? '✓' : '›'}</span>
                </div>
              );
            })}
            <div style={{ height: 1, background: 'rgba(174,156,255,0.1)', margin: '10px 0 10px' }} />
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>o seleziona manualmente</div>
          </div>
        )}

        {/* Griglia CartaWaifu piccola (identica alla Collezione) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ownedWaifu.map(w => {
            const selIdx = selectedIds.indexOf(w.id);
            const sel = selIdx !== -1;
            return (
              <div key={w.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggle(w.id)}>
                <div style={{
                  outline: sel ? `3px solid ${C.gold}` : '3px solid transparent',
                  borderRadius: 14, transition: 'outline 0.15s',
                  boxShadow: sel ? `0 0 16px ${C.gold}50` : 'none',
                }}>
                  <CartaWaifu
                    waifu={w}
                    datiCollezione={w._datiColl}
                    dimensione="piccola"
                    evidenziato={false}
                  />
                </div>
                {sel && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: C.gold, color: '#1a0024',
                    display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 12,
                    boxShadow: `0 2px 8px ${C.gold}80`,
                  }}>{selIdx + 1}</div>
                )}
              </div>
            );
          })}
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
