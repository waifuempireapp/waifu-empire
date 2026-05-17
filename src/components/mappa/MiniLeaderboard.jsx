'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';

// Calcola top holders dai chunk dati
function computeLeaderboard(chunks, limit = 5) {
  const counts = {};
  const names = {};
  const colors = {};
  if (!chunks) return [];
  for (const chunk of Object.values(chunks)) {
    if (!chunk.pixels) continue;
    for (const data of Object.values(chunk.pixels)) {
      if (data.ownerId === 'CPU') continue;
      counts[data.ownerId] = (counts[data.ownerId] ?? 0) + 1;
      names[data.ownerId] = data.ownerName;
      colors[data.ownerId] = data.ownerColor;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([uid, count]) => ({ uid, count, name: names[uid], color: colors[uid] }));
}

export default function MiniLeaderboard({ chunks, userUid, profilo, passiveRate, user, onKissesUpdate }) {
  const [claiming, setClaiming] = useState(false);
  const [lastEarned, setLastEarned] = useState(null);

  const leaders = computeLeaderboard(chunks);

  // Conta pixel CPU e totale pixel terra
  const cpuCount = (() => {
    if (!chunks) return 0;
    let c = 0;
    for (const chunk of Object.values(chunks)) {
      if (!chunk.pixels) continue;
      for (const data of Object.values(chunk.pixels)) {
        if (data.ownerId === 'CPU') c++;
      }
    }
    return c;
  })();
  const pixelCount = profilo?.pixelCount ?? 0;
  const passivePerHour = pixelCount * (passiveRate ?? 1);

  const claim = async () => {
    if (claiming || pixelCount === 0) return;
    setClaiming(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mappa/passive-kisses/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.earned > 0) {
        setLastEarned(data.earned);
        onKissesUpdate?.(data.earned);
        setTimeout(() => setLastEarned(null), 3000);
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(13,10,38,0.85)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(174,156,255,0.1)',
      borderBottom: '1px solid rgba(174,156,255,0.1)',
      padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {/* Passive income claim */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          background: 'rgba(245,197,96,0.08)', border: '1px solid rgba(245,197,96,0.2)',
          borderRadius: 10, padding: '5px 10px', cursor: pixelCount > 0 ? 'pointer' : 'default',
        }} onClick={claim}>
          <KissesIcon size={13} />
          <span style={{ fontFamily: FF.mono, fontSize: 11, color: C.gold }}>
            +{passivePerHour}/h
          </span>
          {pixelCount > 0 && (
            <span style={{
              fontFamily: FF.label, fontSize: 9, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: claiming ? 'rgba(241,235,255,0.3)' : C.aqua,
            }}>
              {claiming ? '…' : lastEarned ? `+${lastEarned}!` : 'claim'}
            </span>
          )}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(174,156,255,0.1)', flexShrink: 0 }} />

        {/* Top holders */}
        {leaders.map((l, i) => (
          <div key={l.uid} style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            opacity: l.uid === userUid ? 1 : 0.7,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: l.color || '#888',
              border: l.uid === userUid ? `1px solid ${C.gold}` : 'none',
            }} />
            <span style={{
              fontFamily: FF.label, fontSize: 10, letterSpacing: '0.12em',
              color: l.uid === userUid ? C.goldL : 'rgba(241,235,255,0.6)',
              maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{l.name}</span>
            <span style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(174,156,255,0.6)' }}>·{l.count}</span>
          </div>
        ))}

        {/* CPU territory count */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          borderLeft: '1px solid rgba(174,156,255,0.1)', paddingLeft: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#888888', flexShrink: 0 }} />
          <span style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(241,235,255,0.4)' }}>CPU</span>
          <span style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(174,156,255,0.5)' }}>·{cpuCount}</span>
        </div>

        {leaders.length === 0 && (
          <span style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.3)' }}>
            Nessun pixel conquistato ancora
          </span>
        )}
      </div>
    </div>
  );
}
