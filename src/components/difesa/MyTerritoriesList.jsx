'use client';
import { useState, useEffect } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

export default function MyTerritoriesList({ chunks, userUid, defenseMap, waifuCat, onEditPixel }) {
  const [territories, setTerritories] = useState([]);

  useEffect(() => {
    if (!chunks || !userUid) return;
    const owned = [];
    for (const [chunkId, chunk] of Object.entries(chunks)) {
      if (!chunk.pixels) continue;
      for (const [key, data] of Object.entries(chunk.pixels)) {
        if (data.ownerId === userUid) owned.push({ key, ...data });
      }
    }
    setTerritories(owned);
  }, [chunks, userUid]);

  if (territories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(241,235,255,0.35)', fontFamily: FF.body, fontSize: 13 }}>
        Nessun territorio posseduto.<br/>Conquista il tuo primo pixel nella Mappa!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px' }}>
      <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: 'rgba(174,156,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>
        {territories.length} territori posseduti
      </div>
      {territories.map(t => {
        const [gx, gy] = t.key.split('_').map(Number);
        const team = defenseMap?.[t.key] || [];
        const teamWaifu = team.map(id => waifuCat?.find(w => w.id === id)).filter(Boolean);
        return (
          <div key={t.key} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(174,156,255,0.1)',
            borderRadius: 14, padding: '10px 14px',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: t.ownerColor || '#888', flexShrink: 0 }} />
            <div style={{ fontFamily: FF.mono, fontSize: 11, color: 'rgba(241,235,255,0.6)', minWidth: 60 }}>
              ({gx}, {gy})
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 4 }}>
              {teamWaifu.length > 0 ? teamWaifu.map((w, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(174,156,255,0.2)', flexShrink: 0 }}>
                  {w.asset_immagine && <img src={w.asset_immagine} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              )) : (
                <span style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(241,235,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>No team</span>
              )}
            </div>
            <button onClick={() => onEditPixel?.(t.key, gx, gy)} style={{
              background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 8, color: C.violet, fontFamily: FF.label, fontSize: 9,
              letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer',
            }}>Modifica</button>
          </div>
        );
      })}
    </div>
  );
}
