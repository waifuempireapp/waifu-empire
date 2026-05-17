'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

function MiniWaifuCard({ waifu, selIdx, onClick }) {
  const sel = selIdx !== -1;
  const rarColor = {
    comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
    leggendario: '#ffc861', immersivo: '#ff7eb6',
  }[waifu?.rarita] ?? '#b4bcc8';

  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer', borderRadius: 12,
      border: `2px solid ${sel ? rarColor : 'rgba(174,156,255,0.12)'}`,
      boxShadow: sel ? `0 0 14px ${rarColor}50` : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      overflow: 'hidden', background: '#12102a', aspectRatio: '3/4',
    }}>
      {(waifu?.asset_immagine || waifu?.asset_statica || waifu?.asset_immersiva) ? (
        <img src={waifu.asset_immagine || waifu.asset_statica || waifu.asset_immersiva} alt={waifu?.nome}
          style={{ width: '100%', height: '75%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '75%', background: `${rarColor}22`, display: 'grid', placeItems: 'center' }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>♛</span>
        </div>
      )}
      <div style={{ padding: '4px 6px', height: '25%', background: 'linear-gradient(transparent, rgba(3,2,12,0.95))', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: FF.body, fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{waifu?.nome}</div>
        <div style={{ fontFamily: FF.label, fontSize: 7, color: rarColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>{waifu?.rarita}</div>
      </div>
      {sel && (
        <div style={{
          position: 'absolute', top: 5, right: 5, zIndex: 2,
          width: 20, height: 20, borderRadius: '50%',
          background: rarColor, color: '#0d0a26',
          display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 11,
          boxShadow: `0 2px 8px ${rarColor}80`,
        }}>{selIdx + 1}</div>
      )}
    </div>
  );
}

// Card compatta per un preset team salvato
function PresetCard({ preset, waifuCat, onSelect, isActive }) {
  const waifu5 = (preset.waifu || []).map(id => waifuCat?.find(w => w.id === id)).filter(Boolean);
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
        background: isActive ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isActive ? C.violet : 'rgba(174,156,255,0.15)'}`,
        transition: 'all 0.15s', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {/* Nome preset */}
      <div style={{
        fontFamily: FF.label, fontSize: 11, letterSpacing: '0.12em',
        color: isActive ? C.violet : 'rgba(241,235,255,0.8)',
        textTransform: 'uppercase', minWidth: 70, flexShrink: 0,
      }}>
        {preset.nome || 'Team'}
      </div>
      {/* Mini-icone 5 waifu */}
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {waifu5.map((w, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
            border: `1px solid ${isActive ? C.violet + '80' : 'rgba(174,156,255,0.15)'}`,
          }}>
            {(w.asset_immagine || w.asset_statica || w.asset_immersiva) && (
              <img src={w.asset_immagine || w.asset_statica || w.asset_immersiva} alt={w.nome}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 5 - waifu5.length) }).map((_, i) => (
          <div key={`e${i}`} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(174,156,255,0.1)', flexShrink: 0 }} />
        ))}
      </div>
      {/* Indicatore selezione */}
      <div style={{ fontSize: 16, color: isActive ? C.violet : 'rgba(174,156,255,0.25)', flexShrink: 0 }}>
        {isActive ? '✓' : '›'}
      </div>
    </div>
  );
}

export default function BattleModal({ pixel, collezione, waifuCat, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);

  const teams = collezione?.teams || {};
  const presets = Object.entries(teams).filter(([, t]) => t.waifu?.length === 5);

  const ownedWaifu = Object.entries(collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = waifuCat?.find(x => x.id === id);
      return w ? { ...w, ...dati } : null;
    })
    .filter(Boolean);

  const toggle = (id) => {
    setActivePresetId(null); // preset deselezionato se si seleziona manualmente
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const selectPreset = (presetId, presetWaifu) => {
    // Valida: tutte le waifu del preset devono essere nella collezione
    const valid = presetWaifu.filter(id => ownedWaifu.some(w => w.id === id));
    if (valid.length === 5) {
      setSelectedIds(valid);
      setActivePresetId(presetId);
    }
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {/* Preset team salvati (se presenti) */}
        {presets.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.55)', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚡ Team salvati
            </div>
            {presets.map(([id, preset]) => (
              <PresetCard
                key={id}
                preset={preset}
                waifuCat={waifuCat}
                isActive={activePresetId === id}
                onSelect={() => selectPreset(id, preset.waifu)}
              />
            ))}
            <div style={{ height: 1, background: 'rgba(174,156,255,0.1)', margin: '12px 0' }} />
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>
              o seleziona manualmente
            </div>
          </div>
        )}

        {/* Griglia waifu */}
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
