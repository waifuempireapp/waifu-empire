'use client';
import { useState, useMemo, useEffect } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { CartaWaifu } from '@/components/CartaWaifu';
import { RARITA } from '@/lib/constants';

const PAGE_SIZE = 9; // 9 per pagina (3×3 griglia)

// Filtri disponibili
const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo'];

function PresetCard({ preset, waifuCat, isActive, onSelect }) {
  const w5 = (preset.waifu || []).map(id => waifuCat?.find(w => w.id === id)).filter(Boolean);
  return (
    <div onClick={onSelect} style={{
      padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
      background: isActive ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isActive ? C.violet : 'rgba(174,156,255,0.15)'}`,
      transition: 'all 0.15s', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ fontFamily: FF.label, fontSize: 11, color: isActive ? C.violet : 'rgba(241,235,255,0.8)', textTransform: 'uppercase', minWidth: 70, flexShrink: 0 }}>
        {preset.nome || 'Team'}
      </div>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {w5.map((w, i) => (
          <div key={i} style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', border: `1px solid ${isActive ? C.violet + '60' : 'rgba(174,156,255,0.15)'}`, background: '#12102a', flexShrink: 0 }}>
            {(w.asset_immagine || w.asset_statica) && (
              <img src={w.asset_immagine || w.asset_statica} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 5 - w5.length) }).map((_, i) => (
          <div key={`e${i}`} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(174,156,255,0.1)', flexShrink: 0 }} />
        ))}
      </div>
      <span style={{ color: isActive ? C.violet : 'rgba(174,156,255,0.3)', fontSize: 14 }}>{isActive ? '✓' : '›'}</span>
    </div>
  );
}

export default function BattleModal({ pixel, collezione, waifuCat, onConfirm, onClose }) {
  const teams = collezione?.teams || {};
  const presets = Object.entries(teams).filter(([, t]) => t.waifu?.length === 5);
  const hasTeams = presets.length > 0;

  // Offset top per non andare sotto l'header
  const [topOffset, setTopOffset] = useState(0);
  useEffect(() => {
    const hdr = document.querySelector('.hdr-root');
    const ntabs = document.querySelector('.ntabs-root');
    setTopOffset((hdr ? hdr.getBoundingClientRect().height : 0) + (ntabs ? ntabs.getBoundingClientRect().height : 0));
  }, []);

  // mode: 'teams' (default se ho team) | 'manual'
  const [mode, setMode] = useState(hasTeams ? 'teams' : 'manual');
  const [selectedIds, setSelectedIds] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);

  // Paginazione e filtri (solo in modalità manual)
  const [page, setPage] = useState(0);
  const [filterRarity, setFilterRarity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('rarita'); // rarita | velocita | crit

  const ownedWaifu = useMemo(() => {
    const list = Object.entries(collezione?.waifu || {})
      .map(([id, dati]) => {
        const w = waifuCat?.find(x => x.id === id);
        return w ? { ...w, ...dati, _datiColl: dati } : null;
      })
      .filter(Boolean);
    // Ordina in base al criterio scelto
    if (sortBy === 'rarita') list.sort((a, b) => RARITY_ORDER.indexOf(b.rarita) - RARITY_ORDER.indexOf(a.rarita));
    else if (sortBy === 'velocita') list.sort((a, b) => (b.battleStats?.speed ?? 0) - (a.battleStats?.speed ?? 0));
    else if (sortBy === 'crit') list.sort((a, b) => (b.battleStats?.critChance ?? 0) - (a.battleStats?.critChance ?? 0));
    return list;
  }, [collezione, waifuCat, sortBy]);

  const filtered = useMemo(() => ownedWaifu.filter(w => {
    // Fix: confronto case-insensitive per rarità e tipo
    if (filterRarity && (w.rarita?.toLowerCase() !== filterRarity.toLowerCase())) return false;
    if (filterType && (w.tipo !== filterType && w.battleStats?.type !== filterType)) return false;
    return true;
  }), [ownedWaifu, filterRarity, filterType]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageWaifu  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggle = (id) => {
    setActivePresetId(null);
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const selectPreset = (id, presetWaifu) => {
    const valid = presetWaifu.filter(wid => ownedWaifu.some(w => w.id === wid));
    if (valid.length === 5) { setSelectedIds(valid); setActivePresetId(id); }
  };

  const confirm = () => {
    if (selectedIds.length === 5) onConfirm(selectedIds);
  };

  const rarColors = {
    comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
    leggendario: '#ffc861', immersivo: '#ff7eb6',
  };

  return (
    <div style={{
      position: 'fixed', top: topOffset, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>◆ CONQUISTA</div>
          <div style={{ fontFamily: FF.display, fontSize: 17, color: '#fff', fontWeight: 800 }}>
            {mode === 'teams' ? 'Scegli il team' : 'Selezione manuale'}
          </div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
            {pixel?.name || `(${pixel?.x}, ${pixel?.y})`} {mode === 'manual' && `· ${selectedIds.length}/5`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode === 'manual' && hasTeams && (
            <button onClick={() => { setMode('teams'); setSelectedIds([]); setActivePresetId(null); }} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(174,156,255,0.2)',
              borderRadius: 8, color: 'rgba(241,235,255,0.6)', fontFamily: FF.label,
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer',
            }}>← Team</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
      </div>

      {/* ── MODALITÀ TEAM ─────────────────────────────────────────── */}
      {mode === 'teams' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 0' }}>
            <div style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.5)', lineHeight: 1.4, marginBottom: 12 }}>
              💡 Scegli un team già salvato, oppure seleziona 5 waifu con cui vuoi combattere. Nella prossima schermata potrai scegliere le 3 migliori waifu per affrontare il primo round.
            </div>
            {presets.map(([id, preset]) => (
              <PresetCard
                key={id} preset={preset} waifuCat={waifuCat}
                isActive={activePresetId === id}
                onSelect={() => selectPreset(id, preset.waifu)}
              />
            ))}

            {/* Bottone selezione manuale */}
            <button
              onClick={() => { setMode('manual'); setSelectedIds([]); setActivePresetId(null); }}
              style={{
                width: '100%', marginTop: 12, padding: '13px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(174,156,255,0.2)',
                borderRadius: 14, color: 'rgba(241,235,255,0.6)', fontFamily: FF.label,
                fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >MANUALE — scegli waifu</button>
          </div>
          <div style={{ padding: '14px 16px 30px', flexShrink: 0 }}>
            <button
              onClick={confirm}
              disabled={selectedIds.length !== 5}
              style={{
                width: '100%', padding: '15px',
                background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: 14,
                cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
                color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
                fontFamily: FF.label, fontSize: 14, letterSpacing: '0.2em',
                textTransform: 'uppercase', fontWeight: 700,
              }}
            >{selectedIds.length === 5 ? '⚔ Avvia Battaglia' : 'Seleziona un team'}</button>
          </div>
        </>
      )}

      {/* ── MODALITÀ MANUALE ──────────────────────────────────────── */}
      {mode === 'manual' && (
        <>
          {/* Istruzione per l'utente */}
          <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
            <div style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.5)', lineHeight: 1.4, marginBottom: 6 }}>
              💡 Seleziona <strong style={{ color: C.gold }}>5 waifu</strong> con cui vuoi combattere. Nella prossima schermata potrai scegliere le 3 migliori waifu per affrontare il primo round.
            </div>
          </div>

          {/* Filtri e ordinamento */}
          <div style={{ padding: '6px 16px 0', display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
            <select value={filterRarity} onChange={e => { setFilterRarity(e.target.value); setPage(0); }}
              style={filterSelectStyle(!!filterRarity)}>
              <option value="">Rarità</option>
              {RARITY_ORDER.map(r => <option key={r} value={r} style={{ background: '#0d0a26', color: rarColors[r] }}>{r}</option>)}
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
              style={filterSelectStyle(!!filterType)}>
              <option value="">Tipo</option>
              {['Arcana','Natura','Abisso','Ferro','Fuoco'].map(t => <option key={t} value={t} style={{ background: '#0d0a26' }}>{t}</option>)}
            </select>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }}
              style={filterSelectStyle(sortBy !== 'rarita')}>
              <option value="rarita">↕ Rarità</option>
              <option value="velocita">↕ Velocità</option>
              <option value="crit">↕ % Critico</option>
            </select>
          </div>
          {(filterRarity || filterType) && (
            <div style={{ padding: '3px 16px 0', flexShrink: 0 }}>
              <button onClick={() => { setFilterRarity(''); setFilterType(''); setPage(0); }} style={{
                background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.25)',
                borderRadius: 8, color: C.err, fontFamily: FF.label, fontSize: 10,
                letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 12px', cursor: 'pointer',
              }}>Cancella filtri</button>
            </div>
          )}
          <div style={{ padding: '3px 16px', fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.3)', flexShrink: 0 }}>
            {filtered.length} waifu · pagina {page + 1}/{Math.max(1, totalPages)} · {selectedIds.length}/5 selezionate
          </div>

          {/* Griglia paginata: 3 colonne, CartaWaifu piccola scalata -8% */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {pageWaifu.map(w => {
                const selIdx = selectedIds.indexOf(w.id);
                const sel = selIdx !== -1;
                return (
                  <div
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    style={{
                      position: 'relative', cursor: 'pointer',
                      // Ulteriore riduzione: -18% rispetto a CartaWaifu piccola
                      transform: 'scale(0.82)', transformOrigin: 'top left',
                      width: '122%', // compensa il transform per il layout
                    }}
                  >
                    <div style={{
                      outline: sel ? `3px solid ${C.gold}` : '3px solid transparent',
                      borderRadius: 14, boxShadow: sel ? `0 0 14px ${C.gold}50` : 'none',
                      transition: 'outline 0.15s',
                    }}>
                      <CartaWaifu waifu={w} datiCollezione={w._datiColl} dimensione="piccola" evidenziato={false} />
                    </div>
                    {sel && (
                      <div style={{
                        position: 'absolute', top: 5, right: -3, zIndex: 2,
                        width: 22, height: 22, borderRadius: '50%',
                        background: C.gold, color: '#1a0024',
                        display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12,
                        boxShadow: `0 2px 8px ${C.gold}80`,
                      }}>{selIdx + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 16px 0', flexShrink: 0 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={pageBtn(page === 0)}>←</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} style={pageBtn(false, i === page)}>
                  {i + 1}
                </button>
              )).slice(Math.max(0, page - 2), Math.min(totalPages, page + 3))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={pageBtn(page === totalPages - 1)}>→</button>
            </div>
          )}

          {/* Bottone conferma */}
          <div style={{ padding: '10px 16px 28px', flexShrink: 0 }}>
            <button
              onClick={confirm}
              disabled={selectedIds.length !== 5}
              style={{
                width: '100%', padding: '14px',
                background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: 14,
                cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
                color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
                fontFamily: FF.label, fontSize: 14, letterSpacing: '0.2em',
                textTransform: 'uppercase', fontWeight: 700,
              }}
            >{selectedIds.length === 5 ? '⚔ Avvia Battaglia' : `Seleziona ancora ${5 - selectedIds.length}`}</button>
          </div>
        </>
      )}
    </div>
  );
}

function filterSelectStyle(active = false) {
  return {
    flex: 1, minWidth: 90, background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(174,156,255,0.4)' : 'rgba(174,156,255,0.2)'}`,
    color: active ? '#fff' : 'rgba(241,235,255,0.5)',
    borderRadius: 8, padding: '5px 6px',
    fontFamily: "'DM Sans', sans-serif", fontSize: 11,
  };
}

function pageBtn(disabled, active = false) {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: active ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'rgba(174,156,255,0.15)'}`,
    color: disabled ? 'rgba(241,235,255,0.2)' : active ? '#a78bfa' : 'rgba(241,235,255,0.6)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
  };
}
