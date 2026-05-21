'use client';
import { useState } from 'react';
import { useScrollLock } from '@/lib/useScrollLock';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { CartaWaifu } from '@/components/CartaWaifu';


export default function TeamDifesaEditor({ pixelKey, collezione, waifuCat, user, profilo, currentTeam, onClose, onSaved }) {
  useScrollLock();
  const [selectedIds, setSelectedIds] = useState(currentTeam?.length === 5 ? currentTeam : []);
  const [applyToAll, setApplyToAll] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const ownedWaifu = Object.entries(collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = waifuCat?.find(x => x.id === id);
      return w ? { ...w, ...dati, _datiColl: dati } : null;
    })
    .filter(Boolean);

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const save = async () => {
    if (selectedIds.length !== 5) return;
    if (applyToAll && !confirmBulk) { setConfirmBulk(true); return; }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      let ownedPixels = [pixelKey];
      if (applyToAll) {
        const defSnap = await fetch('/api/difesa', { headers: { Authorization: `Bearer ${token}` } });
        const defData = await defSnap.json();
        ownedPixels = Object.keys(defData.defenseMap || {});
        if (!ownedPixels.includes(pixelKey)) ownedPixels.push(pixelKey);
      }
      await fetch('/api/difesa', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(applyToAll
          ? { bulk: true, team: selectedIds, ownedPixels }
          : { pixelKey, team: selectedIds }
        ),
      });
      setSuccess(true);
      setTimeout(() => { onSaved?.(); }, 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.violet, textTransform: 'uppercase' }}>⚔ Difesa Territorio</div>
          <div style={{ fontFamily: FF.display, fontSize: 17, color: '#fff', fontWeight: 800 }}>Scegli team difensore</div>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
            pixel {pixelKey?.replace('_', ', ')} · {selectedIds.length}/5
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer', paddingTop: 4 }}>✕</button>
      </div>

      {/* Griglia CartaWaifu piccola (identica alla Collezione) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ownedWaifu.map(w => {
            const selIdx = selectedIds.indexOf(w.id);
            const sel = selIdx !== -1;
            return (
              <div key={w.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggle(w.id)}>
                <div style={{
                  outline: sel ? `3px solid ${C.violet}` : '3px solid transparent',
                  borderRadius: 14, transition: 'outline 0.15s',
                  boxShadow: sel ? `0 0 16px ${C.violet}50` : 'none',
                }}>
                  <CartaWaifu waifu={w} datiCollezione={w._datiColl} dimensione="piccola" evidenziato={false} />
                </div>
                {sel && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: C.violet, color: '#fff',
                    display: 'grid', placeItems: 'center',
                    fontWeight: 900, fontSize: 12,
                    boxShadow: `0 2px 8px ${C.violet}80`,
                  }}>{selIdx + 1}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px 30px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Toggle applica a tutti */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div onClick={() => { setApplyToAll(v => !v); setConfirmBulk(false); }} style={{
            width: 40, height: 22, borderRadius: 11,
            background: applyToAll ? C.violet : 'rgba(255,255,255,0.1)',
            border: `1px solid ${applyToAll ? C.violet : 'rgba(174,156,255,0.2)'}`,
            position: 'relative', transition: 'all 0.2s', cursor: 'pointer', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, left: applyToAll ? 20 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.7)' }}>
            Imposta per tutti i territori
          </span>
        </label>

        {confirmBulk && (
          <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '10px 14px', fontFamily: FF.body, fontSize: 12, color: C.violet }}>
            ⚠️ Sovrascrive il team difensore di TUTTI i tuoi pixel. Confermi?
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: 14, color: C.ok, fontFamily: FF.label, fontSize: 12, letterSpacing: '0.18em' }}>✓ TEAM SALVATO</div>
        ) : (
          <button onClick={save} disabled={selectedIds.length !== 5 || loading} style={{
            padding: '14px', width: '100%',
            background: selectedIds.length === 5 && !loading
              ? `linear-gradient(135deg, rgba(107,75,222,0.9), ${C.violet})`
              : 'rgba(255,255,255,0.05)',
            border: 'none', borderRadius: 14,
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: 13, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
          }}>
            {loading ? '…' : confirmBulk ? '⚠️ Conferma e salva' : '⚔ Salva team difensore'}
          </button>
        )}
      </div>
    </div>
  );
}
